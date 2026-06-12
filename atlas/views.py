from django.http import JsonResponse
from django.shortcuts import render

from .models import Atlas, Event, EventConnection, EventParticipant, EventTopic, Person


def index(request):
    atlas = Atlas.objects.order_by("id").first()
    return render(request, "atlas/index.html", {"atlas": atlas})


def atlas_data(request, atlas_slug):
    atlas = Atlas.objects.get(slug=atlas_slug)
    people = [
        {"id": person.slug, "name": person.name, "role": person.role, "bio": person.bio}
        for person in atlas_people(atlas)
    ]
    topics = [
        {
            "id": topic.slug,
            "name": topic.name,
            "color": topic.color,
            "description": topic.description,
        }
        for topic in atlas.topics.all()
    ]
    events = [
        {
            "id": event.slug,
            "title": event.title,
            "date": event.date.isoformat(),
            "display": event.display_date or event.date.strftime("%d %B %Y"),
            "summary": event.summary,
            "significance": event.significance,
            "people": [link.person.slug for link in event.eventparticipant_set.select_related("person")],
            "topics": [link.topic.slug for link in event.eventtopic_set.select_related("topic")],
            "docs": [doc.title for doc in event.sources.all()],
        }
        for event in event_queryset(atlas)
    ]
    return JsonResponse(
        {
            "atlas": {
                "id": atlas.slug,
                "title": atlas.title,
                "subtitle": atlas.subtitle,
                "description": atlas.description,
                "startYear": atlas.start_year,
                "endYear": atlas.end_year,
            },
            "people": people,
            "topics": topics,
            "events": events,
        }
    )


def graph_data(request, atlas_slug):
    atlas = Atlas.objects.get(slug=atlas_slug)
    events = list(event_queryset(atlas))
    event_nodes = [
        {
            "id": f"event:{event.slug}",
            "kind": "event",
            "label": event.title,
            "date": event.date.isoformat(),
            "size": 4 + event.significance,
        }
        for event in events
    ]
    topic_nodes = [
        {
            "id": f"topic:{topic.slug}",
            "kind": "topic",
            "label": topic.name,
            "color": topic.color,
            "size": 8,
        }
        for topic in atlas.topics.all()
    ]
    person_nodes = [
        {"id": f"person:{person.slug}", "kind": "person", "label": person.name, "size": 5}
        for person in atlas_people(atlas)
    ]

    event_topic_links = [
        {
            "source": f"event:{link.event.slug}",
            "target": f"topic:{link.topic.slug}",
            "kind": "event_topic",
            "weight": link.weight,
        }
        for link in EventTopic.objects.filter(event__atlas=atlas).select_related("event", "topic")
    ]
    event_person_links = [
        {
            "source": f"event:{link.event.slug}",
            "target": f"person:{link.person.slug}",
            "kind": "event_person",
            "weight": link.weight,
        }
        for link in EventParticipant.objects.filter(event__atlas=atlas).select_related("event", "person")
    ]
    event_event_links = [
        {
            "source": f"event:{link.from_event.slug}",
            "target": f"event:{link.to_event.slug}",
            "kind": link.connection_type,
            "label": link.label,
            "weight": link.weight,
        }
        for link in EventConnection.objects.filter(atlas=atlas).select_related("from_event", "to_event")
    ]

    return JsonResponse(
        {
            "nodes": event_nodes + topic_nodes + person_nodes,
            "links": event_topic_links + event_person_links + event_event_links,
        }
    )


def event_queryset(atlas):
    return (
        Event.objects.filter(atlas=atlas)
        .prefetch_related("sources", "eventparticipant_set__person", "eventtopic_set__topic")
        .order_by("date", "sort_order")
    )


def atlas_people(atlas):
    return (
        Person.objects.filter(events__atlas=atlas)
        .distinct()
        .order_by("sort_order", "name")
    )
