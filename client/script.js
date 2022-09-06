var ws = new WebSocket("ws://localhost:8000/ws"); //<!--создание объекта веб сокета (подключаемся к серверу ws://localhost:8000/ws, по протоколу websocet, а не html; localhost можно заменить на адрес сервера в интернете/локальной сети)-->

let player = null // чем играет конкретный клиент (крестик или нолик), со старта - null
let currentPlayer = null  // чей ход в данный момент

let infoDisplay = document.getElementById('info') // находим элемент с id="info" (это span блок) чтобы выводить в него сообщения
let infoPlayer = document.getElementById('player') // объект для вывода информации о игроке, кем он играет
let currentPlayerDisplay = document.getElementById('current-player') // объект для вывода информации о игроке, что делает ход

let gameOver = false //флаг конца игры, изначально false - так как не закончена

swaper = {  // объект для свапа игроков (если по ключу спрашиваем X, то получаем O...)
    "X": "O",
    "O": "X"
}

let checks = [ //предзаготовленный список проверок (победные комбинации)
        [0,1,2],
        [3,4,5],
        [6,7,8],
        [0,3,6],
        [1,4,7],
        [2,5,8],
        [0,4,8],
        [6,4,2]]



function highlightAll() { // функция для закрашивания ячеек в серый в случае ничьи
    for (let c=1; c<=9; c++) { //проход по всем id
        document.getElementById(c).style.backgroundColor = 'gray';  // окрашивание background в серый у элемента в цикле
    }
}



function hightLightRow() { // функция для закрашивания победных ячеек в красный цвет
    let cells = []  // создаём пустой список
    for (let c=1; c<=9; c++) {
        cells.push(document.getElementById(c)) // добавляем в него все ячейки с id от 1 до 9
    }
    checks.forEach((row) => { // идём по каждой строке списка проверок
        console.log(row); // вывод в консоль браузера для дебага
        if (cells[row[0]].innerHTML == cells[row[1]].innerHTML && cells[row[0]].innerHTML == cells[row[2]].innerHTML && cells[row[0]].innerHTML != "*") { //если все элементы в проверяемой строке победных комбинация- одинаковы и не '*'
            console.log(cells[row[0]].innerHTML, cells[row[1]].innerHTML, cells[row[2]].innerHTML); // вывод в консоль браузера победных ячеек
            cells[row[0]].style.backgroundColor = 'red';  // окрашивание ячеек в красный
            cells[row[1]].style.backgroundColor = 'red';
            cells[row[2]].style.backgroundColor = 'red';
        return // выходим из функции
        }
    });
}



function checkCell(cell) { // функция проверки ячейки
    if (cell.innerHTML == '*' & player == currentPlayer) { // проверяем внутренний текст '*' и что ход наш — то мы можем сходить в неё
        return true
    }
    return false
}



function cellClick(id) { //<!--функция, обрабатывающая клики по ячейкам-->
//<!--            console.log(id); <!--вывод в консоль браузера переданного id-->
//<!--            ws.send("Cell " + id + " was clicked"); <!--отправка информации на сокет-->
    if (gameOver) { // если игра уже закончена, то сразу выходим из функции (клик по ячейке не приведёт ни к чему)
        return
    }
    cell = document.getElementById(id) // получение элемента из документа по переданному id
    if (checkCell(cell)){  // если проверка ячейки на валидность прошла
        ws.send(JSON.stringify({player: player, cell: id })) // отправляем нашему серверу(сокету) объект из двух полей: player (типа player - кто кликнул) и cell (тип id - номер кликнутой ячейки)
    } else {
        infoDisplay.innerHTML = "Choose another cell! Or wait for your turn" // изменяем внутренний текст элемента infoDisplay в html это span блок с id="info"
    }
}



function toggleplayer() {
    currentPlayer = swaper[currentPlayer] // замена текущего игрока на противоположного (поиск по ключу)
    console.log("Toggler ", player, currentPlayer);  // вывод в консоль браузера игформации для отладки
    if (player == currentPlayer) {  // проверка того, чей сейчас будет ход с тем, на чей клиент идёт ответ
        // если совпало
        infoDisplay.innerHTML = "Your turn!"  // замена информации в html блоке span
        currentPlayerDisplay.innerHTML = player  // смена отображения того, чкй сейчас ход
    } else {
        // если не совпадает пользователь, чей клиент с тем, у кого будет ход
        infoDisplay.innerHTML = "Your opponent's turn!" // замена информации в html блоке span
        currentPlayerDisplay.innerHTML = swaper[player] // смена отображения того, чкй сейчас ход
    }
}



function updateCell(id, sign) {  // функция обновления ячейки, принимающее id ячейки для обновления и символ (крестик или нолик)
    cell = document.getElementById(id)  // ищем ячейку в документе по полученному id
    cell.innerHTML = sign // и заменяем его внутренний текст, на тот, что нам пришол на вход
}



function updateInfo(message) {
    infoDisplay.innerHTML = message //записываем полученное значение во внутренний текст блока с id="info"
}



//ws.onmessage = function(e){ //<!--определяем, что будет выполнятся при получении сокетом(сервером) информации - будет вызываться функция, что выполниться (на вход - событие e)-->
//    console.log(e); //<!--вывод в консоль браузера переданного СОБЫТИЯ e-->
//}

// инициализация игры
ws.onmessage = function(e) { // определяем, что будет выполнятся при получении сокетом(сервером) информации - будет вызываться функция, что выполниться (на вход - событие e)
    response = JSON.parse(e.data)  // парсим (преобразуем) полученные данные (.data) из ивента 'e' в json объект
    console.log("On message",response); // для отладки выводим в консоль браузера полученные данные из ивента
    if (response.init) { //проверка на то, что сообщение инициализирующее (передано поле init=True)
        infoDisplay.innerHTML = "You play by: "+ response.player + ". " + response.message // выводим на дисплей пользователю, что подключился кем он играет ("X" или "O") и доп ообщение (например, про ожидание другого игрока)
        infoPlayer.innerHTML = response.player // заносим в информацию о игроке, кем он играет
        if (response.message != "Waiting for another player") {  // если сообщение в ответе отличается - значит, что подключился второй игрок и в зависимости отсокета, на который шла отправка - создаются записи о игроках
            player = response.player
        }
        currentPlayer = "X"
        currentPlayerDisplay.innerHTML = "X"
    } else {
        if (response.message == 'move') { //если сервер ответил, что был сделан ход
            updateCell(response.cell, response.player) //обновление ячейки (response.cell - номер ячейки, response.player - крестик или нолик)
            toggleplayer() //переключение на другого игрока
        } else if (response.message == 'draw') { //если сервер ответил, что ничья
            updateInfo("It's a draw")  // выводим сообщение для пользователя, что ничья
            updateCell(response.cell, response.player) // отображаем последний сделанный ход
            highlightAll() // закрашиваем все ячейки, так как игра завершена ничьёй
            ws.close(1000) // закрываем соединение с сервером с кодом 1000
        } else if (response.message == 'won') { //если сервер ответил, что кто-то победил
            updateInfo("Player " + response.player + " won!") // выводим сообщение, какой пользователь победил
            updateCell(response.cell, response.player) // отображаем последний сделанный ход
            hightLightRow() // подсвечиваем выигрышную комбинацию
            ws.close(1000) // закрываем соединение с сервером с кодом 1000
        } else if (response.player == player & response.message == 'choose another one') { //сообщение об ошибке
            updateInfo("Cell is not available") // выводим сообщение, что ячейка недоступна для хода
        } else { // дефолтовый варинт, если ничего не сработало
            console.log(response);
        }
    }
}



//ws.onclose = function(e){ //<!--что будет происходить, когда другая сторона (в нашем случае - менеджер подключений из файла server/main.py) закроет канал связи-->
//    console.log(e); //<!--вывод в консоль браузера переданного СОБЫТИЯ e, ожидаем сообщение с кодом 4000-->
//}
ws.onclose = function(e) { //что будет происходить, когда другая сторона (в нашем случае - менеджер подключений из файла server/main.py) закроет канал связи
    if (e.code == 4000) {  // если код закрытия = 4000
        infoDisplay.innerHTML = "No more places!!" // вывод сообщения о том, что все места уже заняты
    } else if (e.code != 1000){  // если код закрытия - другой (не 1000, как у обычного конца игры)
        infoDisplay.innerHTML = "Error" // вывод сообщения об ошибке
    }
    gameOver = true  //выставляем флаг окончания игры
}