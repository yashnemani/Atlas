from django.urls import path

from . import views


app_name = "atlas"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/atlas/<slug:atlas_slug>/", views.atlas_data, name="atlas_data"),
    path("api/atlas/<slug:atlas_slug>/graph/", views.graph_data, name="graph_data"),
]
