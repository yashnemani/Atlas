from datetime import date

from django.core.management.base import BaseCommand

from atlas.models import (
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


class Command(BaseCommand):
    help = "Seed the first Human Atlas story graph."

    def handle(self, *args, **options):
        atlas, _ = Atlas.objects.update_or_create(
            slug="india-1991-reforms",
            defaults={
                "title": "1991: The Reform Story",
                "subtitle": "A connected atlas of people, pressure, and policy during India's reform moment.",
                "description": "A graph-led storytelling structure for exploring how events, people, and policy threads shaped India's 1991 reforms.",
                "start_year": 1990,
                "end_year": 1993,
            },
        )

        people = {
            "rao": self.person("rao", "P. V. Narasimha Rao", "Prime Minister, 1991-96"),
            "singh": self.person("singh", "Manmohan Singh", "Finance Minister, 1991-96"),
            "rangarajan": self.person("rangarajan", "C. Rangarajan", "Deputy Governor, RBI"),
            "venkitaramanan": self.person("venkitaramanan", "S. Venkitaramanan", "Governor, RBI"),
            "montek": self.person("montek", "Montek Singh Ahluwalia", "Commerce Secretary"),
            "chidambaram": self.person("chidambaram", "P. Chidambaram", "Commerce Minister"),
            "anverma": self.person("anverma", "A. N. Verma", "Principal Secretary to the PM"),
            "rakesh": self.person("rakesh", "Rakesh Mohan", "Economic Adviser, Industry Ministry"),
        }

        topics = {
            "bop": self.topic(atlas, "bop", "Balance of Payments", "#e3a93c", 1),
            "politics": self.topic(atlas, "politics", "Politics of Reform", "#d4604f", 2),
            "rupee": self.topic(atlas, "rupee", "The Rupee", "#4fb8a8", 3),
            "trade": self.topic(atlas, "trade", "Trade Policy", "#5d8fd4", 4),
            "industry": self.topic(atlas, "industry", "Licence Raj", "#9a6fd0", 5),
            "budget": self.topic(atlas, "budget", "The Budget", "#6cab5f", 6),
            "imf": self.topic(atlas, "imf", "IMF & the World", "#d08a4e", 7),
        }

        e1 = self.event(
            atlas,
            "m-document",
            "The 'M Document' circulates",
            date(1990, 6, 15),
            "June 1990",
            "A quiet reform blueprint circulated before the crisis broke, sketching industrial delicensing, trade reform, and exchange-rate change.",
            [people["montek"]],
            [topics["politics"], topics["industry"], topics["trade"]],
        )
        e2 = self.event(
            atlas,
            "gulf-war-oil-shock",
            "Gulf War oil shock hits the reserves",
            date(1990, 8, 2),
            "August 1990",
            "Oil prices rose, remittances weakened, and India's balance-of-payments pressure became impossible to ignore.",
            [people["venkitaramanan"]],
            [topics["bop"]],
        )
        e3 = self.event(
            atlas,
            "rao-sworn-in",
            "Narasimha Rao sworn in as Prime Minister",
            date(1991, 6, 21),
            "21 June 1991",
            "A minority government took office in the middle of an external payments emergency.",
            [people["rao"], people["anverma"]],
            [topics["politics"]],
        )
        e4 = self.event(
            atlas,
            "singh-finance-minister",
            "Manmohan Singh becomes Finance Minister",
            date(1991, 6, 21),
            "21 June 1991",
            "Rao gave Singh space to make the economic case while he handled the politics.",
            [people["rao"], people["singh"]],
            [topics["politics"], topics["budget"]],
        )
        e5 = self.event(
            atlas,
            "devaluation-hop",
            "Devaluation - the 'hop'",
            date(1991, 7, 1),
            "1 July 1991",
            "The RBI devalued the rupee as the first step toward ending the old exchange-rate regime.",
            [people["singh"], people["rangarajan"], people["venkitaramanan"]],
            [topics["rupee"], topics["bop"]],
        )
        e6 = self.event(
            atlas,
            "trade-policy-reform",
            "Trade policy reform announced",
            date(1991, 7, 4),
            "4 July 1991",
            "Export subsidies and import licensing began giving way to a more open trade system.",
            [people["chidambaram"], people["montek"], people["singh"]],
            [topics["trade"], topics["rupee"]],
        )
        e7 = self.event(
            atlas,
            "new-industrial-policy",
            "The New Industrial Policy abolishes the Licence Raj",
            date(1991, 7, 24),
            "24 July 1991 - morning",
            "Industrial licensing was removed for most sectors, changing how Indian enterprise related to the state.",
            [people["rao"], people["anverma"], people["rakesh"]],
            [topics["industry"], topics["politics"]],
        )
        e8 = self.event(
            atlas,
            "budget-idea-whose-time",
            "The Budget: an idea whose time has come",
            date(1991, 7, 24),
            "24 July 1991 - evening",
            "The budget turned emergency measures into a public argument for a new economic direction.",
            [people["singh"], people["rao"]],
            [topics["budget"], topics["politics"]],
        )
        e9 = self.event(
            atlas,
            "imf-standby",
            "IMF stand-by arrangement approved",
            date(1991, 10, 31),
            "October 1991",
            "External finance and domestic reform moved together as the government used the crisis to accelerate change.",
            [people["singh"], people["montek"], people["venkitaramanan"]],
            [topics["imf"], topics["bop"]],
        )

        self.source(e8, "Union Budget Speech 1991-92, 24 July 1991")
        self.source(e7, "Statement on Industrial Policy, 24 July 1991")

        self.connection(atlas, e1, e6, "echoes", "Blueprint finds its moment", 2)
        self.connection(atlas, e2, e5, "causes", "Reserve pressure forces exchange-rate action", 3)
        self.connection(atlas, e3, e4, "continues", "Government formation creates the reform team", 2)
        self.connection(atlas, e5, e6, "continues", "Exchange-rate reform feeds trade reform", 2)
        self.connection(atlas, e7, e8, "continues", "Industrial policy and budget land on the same day", 3)
        self.connection(atlas, e8, e9, "explains", "Domestic reform supports external financing", 2)

        path, _ = StoryPath.objects.update_or_create(
            atlas=atlas,
            slug="crisis-to-reform",
            defaults={
                "title": "From Crisis to Reform",
                "description": "A curated path through the core reform sequence.",
                "is_featured": True,
            },
        )
        for index, event in enumerate([e2, e3, e4, e5, e6, e7, e8, e9], start=1):
            StoryStep.objects.update_or_create(
                story_path=path,
                event=event,
                defaults={"sort_order": index},
            )

        self.stdout.write(self.style.SUCCESS("Seeded Human Atlas data."))

    def person(self, slug, name, role):
        return Person.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "role": role},
        )[0]

    def topic(self, atlas, slug, name, color, order):
        return Topic.objects.update_or_create(
            atlas=atlas,
            slug=slug,
            defaults={"name": name, "color": color, "sort_order": order},
        )[0]

    def event(self, atlas, slug, title, event_date, display_date, summary, people, topics):
        event = Event.objects.update_or_create(
            atlas=atlas,
            slug=slug,
            defaults={
                "title": title,
                "date": event_date,
                "display_date": display_date,
                "summary": summary,
                "significance": max(1, min(5, len(people) + len(topics) - 1)),
            },
        )[0]
        for order, person in enumerate(people, start=1):
            EventParticipant.objects.update_or_create(
                event=event,
                person=person,
                defaults={"sort_order": order, "weight": 1},
            )
        for order, topic in enumerate(topics, start=1):
            EventTopic.objects.update_or_create(
                event=event,
                topic=topic,
                defaults={"sort_order": order, "weight": 1},
            )
        return event

    def source(self, event, title):
        SourceDocument.objects.update_or_create(event=event, title=title)

    def connection(self, atlas, from_event, to_event, connection_type, label, weight):
        EventConnection.objects.update_or_create(
            atlas=atlas,
            from_event=from_event,
            to_event=to_event,
            connection_type=connection_type,
            defaults={"label": label, "weight": weight},
        )
