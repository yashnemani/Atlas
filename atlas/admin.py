from django.contrib import admin

from .models import (
    Atlas,
    Event,
    EventConnection,
    EventParticipant,
    EventTopic,
    Person,
    SourceDocument,
    StoryPath,
    StoryStep,
    Topic,
)


class EventParticipantInline(admin.TabularInline):
    model = EventParticipant
    extra = 1
    autocomplete_fields = ["person"]


class EventTopicInline(admin.TabularInline):
    model = EventTopic
    extra = 1
    autocomplete_fields = ["topic"]


class SourceDocumentInline(admin.TabularInline):
    model = SourceDocument
    extra = 1


class StoryStepInline(admin.TabularInline):
    model = StoryStep
    extra = 1
    autocomplete_fields = ["event"]


@admin.register(Atlas)
class AtlasAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "start_year", "end_year"]
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ["title", "subtitle", "description"]


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ["name", "role", "sort_order"]
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ["name", "role", "bio"]
    ordering = ["sort_order", "name"]


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ["name", "atlas", "color", "sort_order"]
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ["name", "description"]
    list_filter = ["atlas"]
    ordering = ["atlas", "sort_order", "name"]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "atlas", "date", "significance"]
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ["title", "summary"]
    list_filter = ["atlas", "topics", "people"]
    date_hierarchy = "date"
    inlines = [EventParticipantInline, EventTopicInline, SourceDocumentInline]


@admin.register(EventConnection)
class EventConnectionAdmin(admin.ModelAdmin):
    list_display = ["from_event", "connection_type", "to_event", "weight"]
    list_filter = ["atlas", "connection_type"]
    autocomplete_fields = ["from_event", "to_event"]
    search_fields = ["from_event__title", "to_event__title", "label", "note"]


@admin.register(StoryPath)
class StoryPathAdmin(admin.ModelAdmin):
    list_display = ["title", "atlas", "is_featured", "sort_order"]
    prepopulated_fields = {"slug": ("title",)}
    list_filter = ["atlas", "is_featured"]
    search_fields = ["title", "description"]
    inlines = [StoryStepInline]
