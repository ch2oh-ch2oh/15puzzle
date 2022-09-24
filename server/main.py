from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import json
import random
import js2py

app = FastAPI()


def init_board():  # создание пустой доски 

    new_board = [1,2,3,4,
                 5,6,7,8,
                 9,10,11,12,
                 13,14,15,0]
            
        

    code_for_board_init = ""

    with open("initBoardScript.txt",'r',encoding = 'utf-8') as f:
        code_for_board_init = f.read()
    
    new_board_func = js2py.eval_js(code_for_board_init)

    # random.shuffle(new_board)
    
    # def reshape(lst1, lst2):
    #     last = 0
    #     res = []
    #     for ele in lst1:
    #         res.append(lst2[last : last + len(ele)])
    #         last += len(ele)
    
    #     print("res::", res)
           
    #     return res
    
    # new_board = reshape([
    # [0,1,2,3],
    # [0,1,2,3],
    # [0,1,2,3],
    # [0,1,2,3]
    # ], new_board)
    
    new_board = new_board_func().to_list()

    print(type(new_board), new_board)
    
    return new_board

board = init_board()  # создание нового игрового поля (сохраняем в переменной board список из 9 None)



def is_draw():  # функция проверки на ничью
    global board  # для доступа к глобальной переменной
    for cell in board:
        if not cell:  # если есть хотя бы одна не заполненная ячейка - по это ещё не ничья, возвращаем false
            return False
    board = init_board()  # если проверили все ячейки и не обнаружилось свободное место (ячейка None), то сбрасываем доску
    return True  # возвращаем true, так как ничья



def if_won():  # функция проверки на победу
    global board  # для доступа к глобальной переменной
    # проводим проверки выигрышных комбинаций (все значения в тройке равны и не None)
    if board[0] == board[1] == board[2] != None or \
            board[3] == board[4] == board[5] != None or \
            board[6] == board[7] == board[8] != None or \
            board[0] == board[3] == board[6] != None or \
            board[1] == board[4] == board[7] != None or \
            board[2] == board[5] == board[8] != None or \
            board[0] == board[4] == board[8] != None or \
            board[6] == board[4] == board[2] != None:
        board = init_board()  # сбрасываем доску, так как был выигрышь
        return True  # возвращаем true, так как выигрышь
    return False  # возвращаем false, так как нет выигрышной комбинации


async def update_board(manager, data): # функция обновления доски, асинхронная - так как FastAPI асинхронный framework
    # с аргументами manager - для доступа к списку соединений, data - сами данные для обновления
    ind = int(data['cell']) - 1  # берём из полученного словаря data по ключу 'cell' - индекс элемента для обновления (индексы от 0, а id элементов от 1)
    data['init'] = False  # выключения ключа init (переход от подготовительной фазы в саму игру)
    if not board[ind]:  # проверяем, является ли ячейка по нашему индексу - пустой (значение None)
        board[ind] = data['player']  # заменяем значение ячейки с None на то, что прислал клиент ("X" или "O")
        if if_won(): # проверка на победу
            data['message'] = "won"
        elif is_draw():  # проверка на ничью
            data['message'] = "draw"  # изменяем поле message
        else:  # если игра продолжается
            data['message'] = "move"
    else:  # если выбранная ячейка заполенна
        data['message'] = "choose another one"  # изменяем поле message
    await manager.broadcast(data)  # отправляем обновление всем клиентам
    if data['message'] in ['draw', 'won']:  # в случае, если в поле message ничья или победа
        manager.connections = []  # очищаем список соединений, чтобы было можно принять новых игроков


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
                    'board': init_board(),  # игрок играет крестиками
                    'message': 'Waiting for another player',  # дополнительное сообщение - жди подключения второго игрока
                })
            else:
                # иначе - подключается второй игрок за "нолики"
                await websocket.send_json({  # отправляем ответ второму игроку - джейсоновский объект
                    'init': True,  # это инициализационное сообщение
                    'board': init_board(),  # игрок играет ноликами
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
