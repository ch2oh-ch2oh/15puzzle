from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import json

import time

app = FastAPI()

board_shape = 4 # размер доски

board = [ # начальное (и отслеживаемое) состояние доски
        [[1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 0]],

        [[1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 0]]
        ]

whose_move = 0
null_cell = [3,3] # начальные координаты "незакрашенной" точки\
clicked_cell = None
clicks = 0
players_id_in_game = [0,0,0] # массив флагов под кодключившихся пользователей (0 - игрок 0, 1 - игрок1, 2 - host)


async def update_board(manager, data): # функция обновления доски, асинхронная - так как FastAPI асинхронный framework
    global board, whose_move, null_cell, clicks
    board = data["board"]
    null_cell = data["null_cell"]

    if data["state"] in ["moved", "victory"]:
        player_id = data["player_id"]
        clicked_cell = data['clicked_cell']
        whose_move = int(not data["whose_move"])
        clicks = data["clicks"]
        print("player_id:", player_id, "board after click:", board, "X:", clicked_cell[0], "Y:", clicked_cell[1], " X_null: ", null_cell["x"] ," Y_null: ",null_cell["y"]) # вывод текущего состояния доски и координат элемента, который хотим сменить

        await manager.broadcast({ # даём данные для обновления доски
                    'state': "Update view",
                    'board': board,
                    'whose_move': whose_move,
                    'message': f'Player {whose_move} turn!',
                    'clicked_cell': clicked_cell,
                    'clicks' : clicks,
                    'player_id': player_id,
                    'null_cell': null_cell,
                })
    


class ConnectionManager: #--создание класса для обработки множественных подключений
    def __init__(self): #при создании объекта класса (без вызова конструкторов
        self.connections: List[WebSocket] = [] #создаётся список активных соединений, со старта - он пустой

    async def connect(self, websocket: WebSocket): # метод, определяющий то, как обрабатывать соединение
        print( "Number of connections: " + str(len(self.connections)) + ", trying to connect...")
        if len(self.connections) >= 3:  # проверка на число активных соединений
            await websocket.accept()  # принимаем соединение
            await websocket.close(4000)  # и сразу закрываем соединение с кодом 4000
        else:
            await websocket.accept()  # принимаем соединение
            self.connections.append(websocket)  # при новом соединении - добавляем его в список активных соединений
            time.sleep(1) # для синхронизации подключений...
            if len(self.connections) == 1 and players_id_in_game[2] == 0:  # проверяем число активных соединений (для пользователя-хоста (id -1))
                players_id_in_game[2] = 1 # ставим флаг хоста, что он присоединился
                await self.broadcast({
                    'state': "Host joined",
                    'board': board,
                    'whose_move': whose_move,
                    'message': 'Waiting for players!',
                    'clicked_cell': None,
                    'clicks' : clicks,
                    'player_id': -1,
                    'null_cell': null_cell,
                })
            elif len(self.connections) == 2 and players_id_in_game[0] == 0: # подключился первый игрок (id 0)
                players_id_in_game[0] = 1
                await self.broadcast({ # отправляем ответ всем присоединившимся игрокам - джейсоновский объект
                    'state': "Player 0 joined",
                    'board': board,
                    'whose_move': whose_move,
                    'message': 'Waiting for player 1!',  # дополнительное сообщение - жди подключения второго игрока
                    'clicked_cell': None,
                    'clicks' : clicks,
                    'player_id': 0,
                    'null_cell': null_cell,
                })
            else: # иначе - подключился второй игрок (id 1)
                # смотрим, какой пользователь присоединился (на случай, если кто-то выходил)
                who_joined = None 
                for player_id in [0,1]: # поддержка переподключения игроков
                    if players_id_in_game[player_id] == 0:
                        players_id_in_game[player_id] = 1
                        who_joined = player_id
                        break
                print("who joined: ", who_joined)
                await self.broadcast({
                    'state': "Everyone joined",
                    'board': board, # начальное состояние доски состояние доски,
                    'whose_move': whose_move, # продолжаем игру (первый ход игрока с id 0)
                    'message': f'Everything is in place! Player {whose_move} turn.',
                    'clicked_cell': None,
                    'clicks' : clicks,
                    'player_id': who_joined,
                    'null_cell': null_cell, # координаты "незаполненной" клетки
                })

    async def disconnect(self, websocket: WebSocket):  # метод, при дисконекте - удаляющий сокет из списка активных соединений
        global players_id_in_game
        player_left = self.connections.index(websocket) - 1 # -1 из-за смещения, так как в manager.connections host идёт под первым индексом
        if player_left < 0: # вышел host
            players_id_in_game = [0,0,0]
            for websock in self.connections:
                # await websock.close(-1)
                self.connections.remove(websock)
            print("Host left the game!")
            print("Number of connections: " + str(len(self.connections)))

        else: # вышел не host - сохраняем текущие данные
            # await websocket.close(-1)
            self.connections.remove(websocket)
            players_id_in_game[player_left] = 0
            print("Number of connections: " + str(len(self.connections)))
            print(f'Player {player_left} disconnected')
            await self.broadcast({
                'state': f'Player {player_left} disconected',
                'board': board, # сохраняем текущее состояние доски
                'whose_move': whose_move,
                'message': f'Player {player_left} left the game!',
                'clicked_cell': None,
                'clicks' : clicks,
                'player_id': player_left,
                'null_cell': null_cell,
                })

    async def broadcast(self, data): #метод, как отсылать данные (формата json) всем подключённым соединениям
        for connection in self.connections:
            await connection.send_json(data)



manager = ConnectionManager()  # создание объекта менеджера подключений для отслеживания активных соединений

@app.websocket("/ws")  # декоратор того, что ожидается по протоколу websocket (вместо протокола http, так как протокол http не может сам обновлять страницу без запроса пользователя --> при ходе второго игрока, на http протоколе у первого ничего не изменится)
async def websocket_endpoint(websocket: WebSocket):  # асинхронная функция обработчик
    await manager.connect(websocket)  # работаем с вебсокетом через менеджер
#    await websocket.accept()  # принимает connection (запрос от браузера, см консоль в браузере при попытке обновления без этой функции 'WebSocket connection to 'ws://localhost:8000/ws' failed:')
    try:  # после того, как соединились - пытаемся ожидать сообщение от клиента
        while True:
            data = await websocket.receive_text()  # ожидает получения данных со стороны клиента
            print("From JS: " + data)
            data = json.loads(data)  # конвертируем полученный текст в словарь
            await update_board(manager, data)  # асинхронное обновление доски с аргументами manager - для доступа к списку соединений, data - сами данные для обновления
    except WebSocketDisconnect:  # если получаем сообщение об ошибке - websocket разъединён (из-за допустимого числа игроков)
        await manager.disconnect(websocket)  # удаляем объект из списка активных подключений
    except:  # для всех остальных ошибок - просто пропускаем
        pass
