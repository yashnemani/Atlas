from django.db import models


class Atlas(models.Model):
    title = models.CharField(max_length=180)
    slug = models.SlugField(unique=True)
    subtitle = models.CharField(max_length=240, blank=True)
    description = models.TextField(blank=True)
    start_year = models.PositiveSmallIntegerField(null=True, blank=True)
    end_year = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "atlases"

    def __str__(self):
        return self.title


class Person(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=180)
    role = models.CharField(max_length=240, blank=True)
    bio = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class Topic(models.Model):
    atlas = models.ForeignKey(Atlas, related_name="topics", on_delete=models.CASCADE)
    slug = models.SlugField()
    name = models.CharField(max_length=140)
    color = models.CharField(max_length=16, default="#c9a227")
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["atlas", "slug"], name="unique_topic_slug_per_atlas")
        ]

    def __str__(self):
        return self.name


class Event(models.Model):
    atlas = models.ForeignKey(Atlas, related_name="events", on_delete=models.CASCADE)
    slug = models.SlugField()
    title = models.CharField(max_length=240)
    date = models.DateField()
    display_date = models.CharField(max_length=80, blank=True)
    summary = models.TextField()
    significance = models.PositiveSmallIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)
    people = models.ManyToManyField(Person, through="EventParticipant", related_name="events")
    topics = models.ManyToManyField(Topic, through="EventTopic", related_name="events")

    class Meta:
        ordering = ["date", "sort_order", "title"]
        constraints = [
            models.UniqueConstraint(fields=["atlas", "slug"], name="unique_event_slug_per_atlas")
        ]

    def __str__(self):
        return self.title


class EventParticipant(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    person = models.ForeignKey(Person, on_delete=models.CASCADE)
    role_in_event = models.CharField(max_length=180, blank=True)
    weight = models.PositiveSmallIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "person__name"]
        constraints = [
            models.UniqueConstraint(fields=["event", "person"], name="unique_person_per_event")
        ]

    def __str__(self):
        return f"{self.person} in {self.event}"


class EventTopic(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    weight = models.PositiveSmallIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "topic__name"]
        constraints = [
            models.UniqueConstraint(fields=["event", "topic"], name="unique_topic_per_event")
        ]

    def __str__(self):
        return f"{self.event} / {self.topic}"


class SourceDocument(models.Model):
    event = models.ForeignKey(Event, related_name="sources", on_delete=models.CASCADE)
    title = models.CharField(max_length=240)
    citation = models.TextField(blank=True)
    url = models.URLField(blank=True)
    source_type = models.CharField(max_length=80, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


class EventConnection(models.Model):
    CAUSES = "causes"
    CONTINUES = "continues"
    CONTRASTS = "contrasts"
    ECHOES = "echoes"
    EXPLAINS = "explains"

    CONNECTION_TYPES = [
        (CAUSES, "Causes"),
        (CONTINUES, "Continues"),
        (CONTRASTS, "Contrasts"),
        (ECHOES, "Echoes"),
        (EXPLAINS, "Explains"),
    ]

    atlas = models.ForeignKey(Atlas, related_name="connections", on_delete=models.CASCADE)
    from_event = models.ForeignKey(Event, related_name="outgoing_connections", on_delete=models.CASCADE)
    to_event = models.ForeignKey(Event, related_name="incoming_connections", on_delete=models.CASCADE)
    connection_type = models.CharField(max_length=24, choices=CONNECTION_TYPES, default=CONTINUES)
    label = models.CharField(max_length=180, blank=True)
    note = models.TextField(blank=True)
    weight = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["from_event__date", "to_event__date"]
        constraints = [
            models.UniqueConstraint(
                fields=["from_event", "to_event", "connection_type"],
                name="unique_typed_event_connection",
            )
        ]

    def __str__(self):
        return f"{self.from_event} -> {self.to_event}"


class StoryPath(models.Model):
    atlas = models.ForeignKey(Atlas, related_name="story_paths", on_delete=models.CASCADE)
    slug = models.SlugField()
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    is_featured = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "title"]
        constraints = [
            models.UniqueConstraint(fields=["atlas", "slug"], name="unique_story_path_slug_per_atlas")
        ]

    def __str__(self):
        return self.title


class StoryStep(models.Model):
    story_path = models.ForeignKey(StoryPath, related_name="steps", on_delete=models.CASCADE)
    event = models.ForeignKey(Event, related_name="story_steps", on_delete=models.CASCADE)
    title_override = models.CharField(max_length=240, blank=True)
    narration = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]
        constraints = [
            models.UniqueConstraint(fields=["story_path", "event"], name="unique_event_per_story_path")
        ]

    def __str__(self):
        return f"{self.story_path}: {self.event}"
