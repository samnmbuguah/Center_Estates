from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Module
from core.tenancy import get_active_membership, get_active_organization

from .models import Permission, Role
from .serializers import PermissionSerializer, RoleSerializer


CORE_ROLE_SLUGS = {
    "platform-admin",
    "portfolio-manager",
    "finance-officer",
    "operations-staff",
    "read-only",
}
CORE_MODULES = {Module.PROPERTY, Module.FACILITY, Module.COMPANION}


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
        permissions = Permission.objects.filter(module__in=CORE_MODULES).order_by("module", "key")
        return Response(PermissionSerializer(permissions, many=True).data)


class RoleListCreateView(OrganizationAdminAPIView):
    serializer_class = RoleSerializer

    def get(self, request):
        organization, error = self.context(request)
        if error:
            return error
        roles = organization.roles.filter(is_system=False) | organization.roles.filter(slug__in=CORE_ROLE_SLUGS)
        roles = roles.distinct().prefetch_related("permissions", "memberships").order_by("is_system", "name")
        return Response(RoleSerializer(roles, many=True).data)

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
    def get(self, request):
        organization, error = self.context(request)
        if error:
            return error
        property_id = request.query_params.get("property")
        memberships = organization.memberships.filter(status=Membership.Status.ACTIVE).select_related("user").prefetch_related("roles", "assigned_properties")
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
        membership.save()

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
        membership.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
