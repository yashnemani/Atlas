from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Atlas',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=180)),
                ('slug', models.SlugField(unique=True)),
                ('subtitle', models.CharField(blank=True, max_length=240)),
                ('description', models.TextField(blank=True)),
                ('start_year', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('end_year', models.PositiveSmallIntegerField(blank=True, null=True)),
            ],
            options={
                'verbose_name_plural': 'atlases',
            },
        ),
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField()),
                ('title', models.CharField(max_length=240)),
                ('date', models.DateField()),
                ('display_date', models.CharField(blank=True, max_length=80)),
                ('summary', models.TextField()),
                ('significance', models.PositiveSmallIntegerField(default=1)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('atlas', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='atlas.atlas')),
            ],
            options={
                'ordering': ['date', 'sort_order', 'title'],
            },
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(unique=True)),
                ('name', models.CharField(max_length=180)),
                ('role', models.CharField(blank=True, max_length=240)),
                ('bio', models.TextField(blank=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='StoryPath',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField()),
                ('title', models.CharField(max_length=180)),
                ('description', models.TextField(blank=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('atlas', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='story_paths', to='atlas.atlas')),
            ],
            options={
                'ordering': ['sort_order', 'title'],
            },
        ),
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField()),
                ('name', models.CharField(max_length=140)),
                ('color', models.CharField(default='#c9a227', max_length=16)),
                ('description', models.TextField(blank=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('atlas', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='topics', to='atlas.atlas')),
            ],
            options={
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='StoryStep',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title_override', models.CharField(blank=True, max_length=240)),
                ('narration', models.TextField(blank=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='story_steps', to='atlas.event')),
                ('story_path', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='steps', to='atlas.storypath')),
            ],
            options={
                'ordering': ['sort_order'],
            },
        ),
        migrations.CreateModel(
            name='SourceDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=240)),
                ('citation', models.TextField(blank=True)),
                ('url', models.URLField(blank=True)),
                ('source_type', models.CharField(blank=True, max_length=80)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sources', to='atlas.event')),
            ],
            options={
                'ordering': ['sort_order', 'title'],
            },
        ),
        migrations.CreateModel(
            name='EventTopic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('weight', models.PositiveSmallIntegerField(default=1)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='atlas.event')),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='atlas.topic')),
            ],
            options={
                'ordering': ['sort_order', 'topic__name'],
            },
        ),
        migrations.CreateModel(
            name='EventParticipant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role_in_event', models.CharField(blank=True, max_length=180)),
                ('weight', models.PositiveSmallIntegerField(default=1)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='atlas.event')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='atlas.person')),
            ],
            options={
                'ordering': ['sort_order', 'person__name'],
            },
        ),
        migrations.CreateModel(
            name='EventConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('connection_type', models.CharField(choices=[('causes', 'Causes'), ('continues', 'Continues'), ('contrasts', 'Contrasts'), ('echoes', 'Echoes'), ('explains', 'Explains')], default='continues', max_length=24)),
                ('label', models.CharField(blank=True, max_length=180)),
                ('note', models.TextField(blank=True)),
                ('weight', models.PositiveSmallIntegerField(default=1)),
                ('atlas', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='connections', to='atlas.atlas')),
                ('from_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='outgoing_connections', to='atlas.event')),
                ('to_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incoming_connections', to='atlas.event')),
            ],
            options={
                'ordering': ['from_event__date', 'to_event__date'],
            },
        ),
        migrations.AddField(
            model_name='event',
            name='people',
            field=models.ManyToManyField(related_name='events', through='atlas.EventParticipant', to='atlas.person'),
        ),
        migrations.AddField(
            model_name='event',
            name='topics',
            field=models.ManyToManyField(related_name='events', through='atlas.EventTopic', to='atlas.topic'),
        ),
        migrations.AddConstraint(
            model_name='topic',
            constraint=models.UniqueConstraint(fields=('atlas', 'slug'), name='unique_topic_slug_per_atlas'),
        ),
        migrations.AddConstraint(
            model_name='storystep',
            constraint=models.UniqueConstraint(fields=('story_path', 'event'), name='unique_event_per_story_path'),
        ),
        migrations.AddConstraint(
            model_name='storypath',
            constraint=models.UniqueConstraint(fields=('atlas', 'slug'), name='unique_story_path_slug_per_atlas'),
        ),
        migrations.AddConstraint(
            model_name='eventtopic',
            constraint=models.UniqueConstraint(fields=('event', 'topic'), name='unique_topic_per_event'),
        ),
        migrations.AddConstraint(
            model_name='eventparticipant',
            constraint=models.UniqueConstraint(fields=('event', 'person'), name='unique_person_per_event'),
        ),
        migrations.AddConstraint(
            model_name='eventconnection',
            constraint=models.UniqueConstraint(fields=('from_event', 'to_event', 'connection_type'), name='unique_typed_event_connection'),
        ),
        migrations.AddConstraint(
            model_name='event',
            constraint=models.UniqueConstraint(fields=('atlas', 'slug'), name='unique_event_slug_per_atlas'),
        ),
    ]
