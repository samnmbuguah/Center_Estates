from django.contrib import admin

from .models import Task, TaskEvent, TaskTemplate


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('reference', 'title', 'assignee', 'status', 'priority', 'due_at', 'escalated')
    list_filter = ('status', 'priority', 'source_module', 'escalated')
    search_fields = ('reference', 'title', 'assignee__username')


@admin.register(TaskTemplate)
class TaskTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'default_priority', 'default_days_to_due', 'sla_hours', 'is_active')
    search_fields = ('name',)


@admin.register(TaskEvent)
class TaskEventAdmin(admin.ModelAdmin):
    list_display = ('task', 'actor', 'action', 'created_at')
    list_filter = ('action',)
