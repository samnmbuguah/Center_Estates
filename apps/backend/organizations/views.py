from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Module
from core.tenancy import get_active_membership, get_active_organization

from .models import Membership, Permission, Role
from .serializers import CreateMemberSerializer, MemberSerializer, PermissionSerializer, RoleSerializer
from .services import ensure_permission_catalog, ensure_standard_roles_for_organization


class OrganizationAdminAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def context(self, request):
        organization = get_active_organization(request, required=False)
        membership = get_active_membership(request, organization) if organization else None
        if not organization or not membership:
            return None, Response(
                {"detail": "An active organization membership is required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not (request.user.is_superuser or membership.is_organization_admin):
            return None, Response(
                {"detail": "Only organization administrators can manage roles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return organization, None


class PermissionListView(OrganizationAdminAPIView):
    serializer_class = PermissionSerializer

    def get(self, request):
        organization, error = self.context(request)
        if error:
            return error
        import time
        from django.db import OperationalError
        for attempt in range(3):
            try:
                ensure_permission_catalog()
                permissions = Permission.objects.all().order_by("module", "key")
                return Response(PermissionSerializer(permissions, many=True).data)
            except OperationalError:
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                return Response(
                    {"detail": "Database is busy. Please retry."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except Exception as e:
                return Response(
                    {"detail": f"Error loading permissions: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )


class RoleListCreateView(OrganizationAdminAPIView):
    serializer_class = RoleSerializer

    def get(self, request):
        organization, error = self.context(request)
        if error:
            return error
        import time
        from django.db import OperationalError
        for attempt in range(3):
            try:
                ensure_standard_roles_for_organization(organization)
                roles = organization.roles.all().prefetch_related("permissions", "memberships").order_by("is_system", "name")
                return Response(RoleSerializer(roles, many=True).data)
            except OperationalError:
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                return Response(
                    {"detail": "Database is busy. Please retry."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except Exception as e:
                return Response(
                    {"detail": f"Error loading roles: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

    def post(self, request):
        organization, error = self.context(request)
        if error:
            return error
        serializer = RoleSerializer(data=request.data, context={"organization": organization})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RoleDetailView(OrganizationAdminAPIView):
    serializer_class = RoleSerializer

    def get_role(self, organization, role_id):
        return organization.roles.prefetch_related("permissions", "memberships").filter(pk=role_id).first()

    def patch(self, request, role_id):
        organization, error = self.context(request)
        if error:
            return error
        role = self.get_role(organization, role_id)
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
        if role.slug == "platform-admin":
            return Response(
                {"detail": "The platform administrator role always retains full access."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RoleSerializer(
            role, data=request.data, partial=True, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, role_id):
        organization, error = self.context(request)
        if error:
            return error
        role = self.get_role(organization, role_id)
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
        if role.is_system:
            return Response(
                {"detail": "Default roles cannot be deleted. Adjust their feature matrix instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role.memberships.exists():
            return Response(
                {"detail": "Reassign this role's users before deleting it."},
                status=status.HTTP_409_CONFLICT,
            )
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberListCreateView(OrganizationAdminAPIView):
    serializer_class = MemberSerializer

    def get(self, request):
        organization, error = self.context(request)
        if error:
            return error
        property_id = request.query_params.get("property")
        include_inactive = (
            request.query_params.get("include_inactive", "").lower() in ("true", "1")
            or request.query_params.get("all", "").lower() in ("true", "1")
        )
        status_filter = request.query_params.get("status")

        memberships = organization.memberships.select_related("user").prefetch_related("roles", "assigned_properties")
        if status_filter:
            memberships = memberships.filter(status=status_filter)
        elif not include_inactive:
            memberships = memberships.filter(status=Membership.Status.ACTIVE)

        if property_id:
            from django.db.models import Q
            memberships = memberships.filter(
                Q(is_organization_admin=True) | Q(assigned_properties__id=property_id) | Q(assigned_properties__isnull=True)
            ).distinct()
        return Response(MemberSerializer(memberships, many=True).data)

    def post(self, request):
        organization, error = self.context(request)
        if error:
            return error
        serializer = CreateMemberSerializer(data=request.data, context={"organization": organization})
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(MemberSerializer(membership).data, status=status.HTTP_201_CREATED)


class MemberDetailView(OrganizationAdminAPIView):
    serializer_class = MemberSerializer

    def patch(self, request, member_id):
        organization, error = self.context(request)
        if error:
            return error
        membership = organization.memberships.filter(pk=member_id).first()
        if not membership:
            return Response({"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        if "is_organization_admin" in data:
            membership.is_organization_admin = bool(data["is_organization_admin"])
        if "phone_number" in data:
            membership.phone_number = str(data["phone_number"]).strip()
        if "status" in data and data["status"] in Membership.Status.values:
            membership.status = data["status"]
            if data["status"] == Membership.Status.SUSPENDED:
                membership.user.is_active = False
                membership.user.save(update_fields=["is_active"])
            elif data["status"] == Membership.Status.ACTIVE:
                membership.user.is_active = True
                membership.user.save(update_fields=["is_active"])

        # Enable / Disable account toggle
        if "is_active" in data:
            target_is_active = bool(data["is_active"])
            if membership.user == request.user and not target_is_active:
                return Response(
                    {"detail": "You cannot disable your own user account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership.user.is_active = target_is_active
            membership.user.save(update_fields=["is_active"])
            if target_is_active:
                membership.status = Membership.Status.ACTIVE
            else:
                membership.status = Membership.Status.SUSPENDED

        membership.save()

        # Update underlying User record fields
        user_updated_fields = []
        if "email" in data:
            membership.user.email = str(data["email"]).strip()
            user_updated_fields.append("email")
        if "first_name" in data:
            membership.user.first_name = str(data["first_name"]).strip()
            user_updated_fields.append("first_name")
        if "last_name" in data:
            membership.user.last_name = str(data["last_name"]).strip()
            user_updated_fields.append("last_name")

        # Admin reset/change user password
        new_password = str(data.get("password") or data.get("new_password") or "").strip()
        if new_password:
            if len(new_password) < 8:
                return Response(
                    {"detail": "Password must be at least 8 characters long."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                validate_password(new_password, user=membership.user)
            except DjangoValidationError as exc:
                return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
            membership.user.set_password(new_password)
            user_updated_fields.append("password")

        if user_updated_fields:
            membership.user.save(update_fields=user_updated_fields)

        if "role_ids" in data:
            roles = Role.objects.filter(organization=organization, id__in=data["role_ids"])
            membership.roles.set(roles)

        if "property_ids" in data:
            from properties.models import Property
            properties = Property.objects.filter(organization=organization, id__in=data["property_ids"])
            membership.assigned_properties.set(properties)

        return Response(MemberSerializer(membership).data)

    def delete(self, request, member_id):
        organization, error = self.context(request)
        if error:
            return error
        membership = organization.memberships.filter(pk=member_id).first()
        if not membership:
            return Response({"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND)
        if membership.user == request.user:
            return Response({"detail": "You cannot remove your own organization membership."}, status=status.HTTP_400_BAD_REQUEST)
        membership.status = Membership.Status.SUSPENDED
        membership.save(update_fields=["status"])
        membership.user.is_active = False
        membership.user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserProfileView(APIView):
    """
    Endpoint for any authenticated user to inspect and update their own email, name, and phone.
    """
    serializer_class = MemberSerializer
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        email = user.email or ""
        is_placeholder = bool(
            not email
            or "@centerestates.test" in email
            or "@example.com" in email
            or "@ceest.internal" in email
            or "@local" in email
        )
        try:
            organization = get_active_organization(request, required=False)
            membership = get_active_membership(request, organization) if organization else None
        except Exception:
            organization = None
            membership = None

        return Response({
            "id": user.id,
            "username": user.username,
            "email": email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name() or user.username,
            "phone_number": membership.phone_number if membership else "",
            "is_placeholder_email": is_placeholder,
            "is_organization_admin": bool(user.is_superuser or (membership and membership.is_organization_admin)),
            "organization_name": organization.name if organization else "",
        })

    def patch(self, request):
        user = request.user
        data = request.data
        updated_fields = []

        if "email" in data:
            email = str(data["email"]).strip()
            if email and "@" not in email:
                return Response({"detail": "Please provide a valid email address."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
            updated_fields.append("email")

        if "first_name" in data:
            user.first_name = str(data["first_name"]).strip()
            updated_fields.append("first_name")

        if "last_name" in data:
            user.last_name = str(data["last_name"]).strip()
            updated_fields.append("last_name")

        if "new_password" in data:
            current_password = str(data.get("current_password", ""))
            new_password = str(data.get("new_password", ""))
            if not current_password or not user.check_password(current_password):
                return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
            if len(new_password) < 8:
                return Response({"detail": "New password must be at least 8 characters long."}, status=status.HTTP_400_BAD_REQUEST)
            if new_password == current_password:
                return Response({"detail": "New password cannot be identical to current password."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)
            updated_fields.append("password")

        if updated_fields:
            user.save(update_fields=updated_fields)

        organization = get_active_organization(request, required=False)
        membership = get_active_membership(request, organization) if organization else None
        if membership and "phone_number" in data:
            membership.phone_number = str(data["phone_number"]).strip()
            membership.save(update_fields=["phone_number"])

        email = user.email or ""
        is_placeholder = bool(
            not email
            or "@centerestates.test" in email
            or "@example.com" in email
            or "@ceest.internal" in email
            or "@local" in email
        )

        return Response({
            "id": user.id,
            "username": user.username,
            "email": email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name() or user.username,
            "phone_number": membership.phone_number if membership else "",
            "is_placeholder_email": is_placeholder,
            "detail": "Profile updated successfully.",
        })
