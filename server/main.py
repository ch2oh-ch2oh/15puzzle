from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import json
import random
import js2py

app = FastAPI()

board_shape = 4

#js-code for board initializing
code_for_board_init = ""
with open("initBoardScript.txt",'r',encoding = 'utf-8') as f:
    code_for_board_init = f.read()
new_board_func = js2py.eval_js(code_for_board_init)


def init_board(): 
    
    new_board = new_board_func().to_list()

    # print(type(new_board), new_board)
    
    return new_board

board = init_board()  # создание нового игрового поля (сохраняем в переменной board список из 9 None)


async def update_board(manager, data): # функция обновления доски, асинхронная - так как FastAPI асинхронный framework
    print("board::", board, data['cell_x'], data['cell_y'])

    nullCell = {}

    x, y = data['cell_x'], data['cell_y']

    for i in range(board_shape):
        for j in range(board_shape):
            if board[j][i] == 0:
                nullCell = {'x': i, 'y': j}
       
    canMoveVertical = (x - 1 == nullCell['x'] or x + 1 == nullCell['x']) and y == nullCell['y']
    canMoveHorizontal = (y - 1 == nullCell['y'] or y + 1 == nullCell['y']) and x == nullCell['x']    

    if canMoveVertical or canMoveHorizontal:
        board[nullCell['y']][nullCell['x']] = board[y][x]
        board[y][x] = 0

    print("new_board::", board)

    ws_to_send = None

    if data['player'] == 1:
        ws_to_send = manager.connections[0]
    else:
        ws_to_send = manager.connections[1]


    await ws_to_send.send_json({ 'message': 'move', 'x': x, 'y': y })


class ConnectionManager: #--создание класса для обработки множественных подключений
    def __init__(self): #при создании объекта класса (без вызова конструкторов
        self.connections: List[WebSocket] = [] #создаётся список активных соединений, со старта - он пустой

    async def connect(self, websocket: WebSocket): # метод, определяющий то, как обрабатывать соединение
        print(len(self.connections))
        if len(self.connections) >= 2:  # проверка на число активных соединений
            await websocket.accept()  # принимаем соединение
            await websocket.close(4000)  # и сразу закрываем соединение с кодом 4000
        else:
            await websocket.accept()  # принимаем соединение
            # adding the connections to the connection's list
            self.connections.append(websocket)  # при новом соединении - добавляем его в список активных соединений
            if len(self.connections) == 1:  # проверяем число активных соединений
                # первый подключившийся игрок играет за "крестик" и должен подождать второго игрока
                await websocket.send_json({ # отправляем ответ первому игроку - джейсоновский объект
                    'init': True,  # это инициализационное сообщение (созданное нами значение init, если True - то мы как бы говорим, что это не относится к ходам/изменению поля)
                    'board': board,  # игрок играет крестиками
                    'message': 'Waiting for another player',  # дополнительное сообщение - жди подключения второго игрока
                })
            else:
                # иначе - подключается второй игрок за "нолики"
                await websocket.send_json({  # отправляем ответ второму игроку - джейсоновский объект
                    'init': True,  # это инициализационное сообщение
                    'board': board,  # игрок играет ноликами
                    'message': 'Game begins!',
                })
                # отправляем сигнал первому игроку, что второй игрок присоединился
                await self.connections[0].send_json({
                    'init': False,  # это инициализационное сообщение (не изменяет игровое поле)
                    'board': [],
                    'message': 'Your turn!',  # сообщение, что твой ход
                })

    def disconnect(self, websocket: WebSocket):  # метод, при дисконекте - удаляющий сокет из списка активных соединений
        self.connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, data: str): #метод, как отсылать данные (формата json) всем подключённым соединениям
        for connection in self.connections:
            await connection.send_json(data)


manager = ConnectionManager()  # создание объекта менеджера подключений для отслеживания активных соединений

@app.websocket("/ws")  # декоратор того, что ожидается по протоколу websocket (вместо протокола http, так как протокол http не может сам обновлять страницу без запроса пользователя --> при ходе второго игрока, на http протоколе у первого ничего не изменится)
async def websocket_endpoint(websocket: WebSocket):  # асинхронная функция обработчик
    await manager.connect(websocket)  # работаем с вебсокетом через менеджер
#    await websocket.accept()  # принимает connection (запрос от браузера, см консоль в браузере при попытке обновления без этой функции 'WebSocket connection to 'ws://localhost:8000/ws' failed:')
    try:  # после того, как соединились - пытаемся ожидать сообщение от клиента
        while True:
            data = await websocket.receive_text()  # ожидает получения текста со стороны клиента
#            await websocket.send_text(f"Message text was: {data}")  # как только дожидается входящего сообщения - отправляет его обратно с дописанием "Message text was:"
            data = json.loads(data)  # конвертируем полученный текст в словарь
            await update_board(manager, data)  # асинхронное обновление доски с аргументами manager - для доступа к списку соединений, data - сами данные для обновления
    except WebSocketDisconnect:  # если получаем сообщение об ошибке - websocket разъединён (из-за допустимого числа игроков)
        manager.disconnect(websocket)  # удаляем объект из списка активных подключений
    except:  # для всех остальных ошибок - просто пропускаем
        pass
