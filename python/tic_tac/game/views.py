from django.shortcuts import render

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import game.utils as game_utils


class GameSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    player_x = serializers.CharField(max_length=255)
    player_o = serializers.CharField(max_length=255)

    def create(self, validated_data):
        with connection.cursor() as cursor:
            cursor.execute('INSERT INTO games (player_x, player_o) VALUES (%s, %s) RETURNING *', [validated_data['player_x'], validated_data['player_o']])
            game = cursor.fetchone()
        return {
            'id': game[0], 
            'player_x': game[1], 
            'player_o': game[2],
            'status': game[3],
            'winner': game[4],
            'created_at': game[5],
            'updated_at': game[6]
        }

@csrf_exempt
@api_view(['POST'])
def create_game(request):
    serializer = GameSerializer(data=request.data)
    if serializer.is_valid():
        game = serializer.create(serializer.validated_data)
        return JsonResponse(game, status=201)
    else:
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
@api_view(['GET'])
def get_game(request, id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT * FROM games WHERE id = %s', [id])
            game = cursor.fetchone()
            
        if game is None:
            return Response({'message': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = GameSerializer({'id': game[0], 'player_x': game[1], 'player_o': game[2]})
        return Response(serializer.data)
        
    except Exception as e:
        print(str(e))
        return Response({'message': 'An error occurred while getting the game.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

def get_winning_moves(board):
    winning_moves = []
    # Check rows
    for y in range(3):
        if board[y][0] != '_' and board[y][0] == board[y][1] and board[y][1] == board[y][2]:
            winning_moves.append([0, y])
            winning_moves.append([1, y])
            winning_moves.append([2, y])
    # Check columns
    for x in range(3):
        if board[0][x] != '_' and board[0][x] == board[1][x] and board[1][x] == board[2][x]:
            winning_moves.append([x, 0])
            winning_moves.append([x, 1])
            winning_moves.append([x, 2])
    # Check diagonals
    if board[0][0] != '_' and board[0][0] == board[1][1] and board[1][1] == board[2][2]:
        winning_moves.append([0, 0])
        winning_moves.append([1, 1])
        winning_moves.append([2, 2])
    if board[2][0] != '_' and board[2][0] == board[1][1] and board[1][1] == board[0][2]:
        winning_moves.append([2, 0])
        winning_moves.append([1, 1])
        winning_moves.append([0, 2])
    return winning_moves


class MakeMoveSerializer(serializers.Serializer):
    player = serializers.CharField()
    x = serializers.IntegerField()
    y = serializers.IntegerField()

    def validate(self, data):
        # Check if x and y are within the bounds of the board
        if data['x'] < 0 or data['x'] > 2:
            raise serializers.ValidationError("x must be between 0 and 2.")
        if data['y'] < 0 or data['y'] > 2:
            raise serializers.ValidationError("y must be between 0 and 2.")
        return data

@csrf_exempt
@api_view(['POST'])
def make_move(request, id):
    serializer = MakeMoveSerializer(data=request.data)
    if serializer.is_valid():
        player = serializer.validated_data['player']
        x = serializer.validated_data['x']
        y = serializer.validated_data['y']

    with connection.cursor() as cursor:
        # Check if game exists and is in progress
        cursor.execute('SELECT * FROM games WHERE id = %s AND status = %s', [id, 'in_progress'])
        game = cursor.fetchone()
        if not game:
            return JsonResponse({'message': 'Game not found or already ended.'}, status=404)

        # Insert move
        cursor.execute('INSERT INTO moves (game_id, player, x, y) VALUES (%s, %s, %s, %s) RETURNING *', [id, player, x, y])
        move = cursor.fetchone()

        # Update game status if needed
        cursor.execute('SELECT * FROM moves WHERE game_id = %s ORDER BY created_at ASC', [id])
        moves = cursor.fetchall()
        board = [['_', '_', '_'] for _ in range(3)]
        for move in moves:
            if move is not None and x is not None and y is not None:
                board[move[3]][move[4]] = move[2]

        computer_move = game_utils.findBestMove(board)
        if computer_move != (-1, -1):
            cursor.execute('INSERT INTO moves (game_id, player, x, y) VALUES (%s, %s, %s, %s) RETURNING *', [id, "O", computer_move[0], computer_move[1]])
            move = cursor.fetchone()


        winning_moves = get_winning_moves(board)
        if winning_moves:
            status = 'won'
        elif len(moves) == 9:
            status = 'draw'
        else:
            status = 'in_progress'
        cursor.execute('UPDATE games SET status = %s WHERE id = %s', [status, id])
        cursor.execute('SELECT * FROM games WHERE id = %s', [id])
        updated_game = cursor.fetchone()

    return JsonResponse({
        'move': {
            'id': moves[-1][0],
            "game_id" : moves[-1][1],
            'player': moves[-1][2],
            'x': moves[-1][3],
            'y': moves[-1][4],
        },
        'game_status': updated_game[3],
        'winning_moves': winning_moves,
        'computer_move': computer_move,
    }, status=201)
