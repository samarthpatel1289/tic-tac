from django.urls import path
from .views import create_game, get_game, make_move

urlpatterns = [
    path('games/', create_game, name='create_game'),
    path('games/<uuid:id>/', get_game),
    path('games/<uuid:id>/moves/', make_move, name='make_move'),
]