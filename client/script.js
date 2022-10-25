var config = { // конфиг, который в идеале заполнеет host при открытии его страницы
  randomState: 5, 
  mix_count: 300, 
  server_id: "127.0.0.1",
  port: "8000",
}

let player_id = null // Нужно будет переедать id игрока при инициализирующем подключении (0 или 1)
let whose_move = null  // чей ход в данный момент (игрок 0 или игрок 1)
let game = null
let completion = [0,0] // временная заглушка для подсчёта числа правильно поставленных элементов

var ws = new WebSocket("ws://" + config.server_id + ":" + config.port + "/ws"); //<!--создание объекта веб сокета (подключаемся к серверу ws://localhost:8000/ws, по протоколу websocet, а не html; localhost можно заменить на адрес сервера в интернете/локальной сети)-->

function getRandomBool() { // возвращает True или undefined
  res = (Math.floor(Math.random() * 2) === 0); // проверка на то, что сгенерированное число (из равномерного распределения от 0 до 1) меньше 0.5
  return res;
}

class Game {

  constructor(context, cellSize, randomState = 0) { // context - CanvasRenderingContext2D, cellSize - размер ячеек, randomState - число различий между досками
    this.state = [ // массив из двух матриц, для первого и второго игрока
      [[1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 0]],

      [[1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 0]]
    ];

    this.randomState = randomState;
    if (this.randomState > 1) { // randomState - в скольких элементах различаются доски игроков
      let cell_to_change = [];
      let possible_cells_to_change = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
      for (let i = 0; i < Math.min(randomState, 15); i++) { // randomState < 15, так как "незаполненную" клетку нельзя переставлять
        let cell = Math.floor(Math.random() * possible_cells_to_change.length); // cell - индекс ячейки для смены
        cell_to_change.push(possible_cells_to_change[cell]); // добавляем значение ячейки для смены
        possible_cells_to_change.splice(cell, 1); // удаляем значение из допустимых
      }
      let temp = this.state[1][Math.trunc(cell_to_change[0]/4)][cell_to_change[0] % 4]; // сохранение первого элемента
      for (let i = 0; i < cell_to_change.length - 1; i++) {
        this.state[1][Math.trunc(cell_to_change[i]/4)][cell_to_change[i] % 4] = this.state[1][Math.trunc(cell_to_change[i+1]/4)][cell_to_change[i+1] % 4]; // проходим по элементам и меняем местами значения элементов (по первому индексу будет значение со второго индекса ...
      }
      this.state[1][Math.trunc(cell_to_change[cell_to_change.length-1]/4)][cell_to_change[cell_to_change.length-1] % 4] = temp; // значение последнего элемента = значение первого (из cell_to_change)  
    }

    this.color = "#FFB93B"; // сохранение цвета для клеток поля (будет использован с CanvasRenderingContext2D.fillStyle)
    this.context = context; // CanvasRenderingContext2D
    this.cellSize = cellSize; // размер клетки поля
    this.clicks = 0; // начальное число ходов
    this.null_cell = null; // перезапишется, при создании объекта класса
  }


  getClicks() { // возвращает число ходов
    return this.clicks;
  }

  cellView(x, y) { // определяет, как будет выглядеть клетка доски (x,y - координаты)
    this.context.fillStyle = this.color; // цвет клетки
    this.context.fillRect( // CanvasRenderingContext2D.fillRect() — метод Canvas 2D API, рисует прямоугольник, который заполняется в соответствии с текущим стилем fillStyle
      x + 1, // Координата по оси X начальной точки прямоугольника (+1 для смещения относительно левой и верхней границ доски)
      y + 1,  // Координата по оси Y начальной точки прямоугольника (+1 для смещения относительно левой и верхней границ доски)
      this.cellSize - 2, // ширина ячейки (то, что вычитается - размер вертикальной границы)
      this.cellSize - 2 // высота ячейки (то, что вычитается - размер горизонтальной границы)

    );
  }

  
  numView() {  // определяет внешний вид внутренностей ячейки (текста в ней)
    this.context.font = "bold " + (this.cellSize / 2) + "px Sans"; // указывает текущий стиль текста, используемый при рисовании текста
    this.context.textAlign = "center"; // выравнивание текста
    this.context.textBaseline = "middle"; // Свойство Canvas 2D API указывает текущую базовую линию текста, используемую при рисовании текста
    this.context.fillStyle = "#222"; // указывает цвет, градиент или узор для использования внутри фигур (цыет цифр и границ)
  }


  draw() {
    // console.log(player_id)
    // console.log(this.state[player_id])
    if (player_id != 0 && player_id != 1){ // нет вывода, если у пользователя нет id 0 или 1
      return;
    }

    for (let i = 0; i < 4; i++) { // i - число строк
      for (let j = 0; j < 4; j++) { // j - число столбцов
        if (this.state[player_id][i][j] > 0) { // проверка, что ячейка не пустая (не та, которая "незаполнена")
          this.cellView( // вызываем функцию для внешнего вида ячейки
            j * this.cellSize, // умножение для отступа от предыдущей ячейки
            i * this.cellSize
          );
          this.numView(); // выбор стиля для содержимого клетки
          this.context.fillText( // рисует текстовую строку в указанных координатах, заполняя символы строки текущим стилем fillStyle
            this.state[player_id][i][j], // текст, что будет отображаться в ячейке взят из Game.state
            j * this.cellSize + this.cellSize / 2, // Координата по оси X точки, с которой начинается рисование текста, в пикселях.
            i * this.cellSize + this.cellSize / 2 // Координата по оси Y точки, с которой начинается рисование текста, в пикселях.
          );
        }
        else { // для "незаполненной" точки 0 ничего не делаем (никак не расскрашиваем её)
        }
      }
    }
  }


  getNullCell() { // поиск "незаполненной" клетки
    for (let i = 0; i < 4; i++) { // i - число строк
      for (let j = 0; j < 4; j++) { // j - число столбцов
        if (this.state[0][j][i] === 0) { // player_id = 0, так как положение NullCell должно совпадать
          return { x: i, y: j }; // возвращаем объект, координаты "незаполненной" точки
        }
      }
    }
  }


  move(x, y) { // пытаемся передвинуть ячейку с координатами x, y
    let nullCell = this.getNullCell(); // находим текущее положение "незаполненной" клетки
    let canMoveVertical = (x - 1 == nullCell.x || x + 1 == nullCell.x) && y == nullCell.y; // флаг того, что сверху или снизу от выбранной клетки есть "незаполненная" клетки
    let canMoveHorizontal = (y - 1 == nullCell.y || y + 1 == nullCell.y) && x == nullCell.x; // флаг того, что влева или справа от выбранной клетки есть "незаполненная" клетки

    if (canMoveVertical || canMoveHorizontal) { // если рядом с выбранной клеткой есть "незаполненная"
      for (let player = 0; player<2; player++){ // обновляем доски игроков
        this.state[player][nullCell.y][nullCell.x] = this.state[player][y][x]; // "незаполненная" теперь имеет значение выбранной клетки (swap ячеек)
        this.state[player][y][x] = 0; // новой "незаполненной" становится выбранная клетка
      }
      this.clicks++; // увеличиваем число ходов
      this.null_cell = this.getNullCell(); // перезаписываем данные в объекте Game
      return true;
    }
    return false;
  }


  victory() { // проверка на победу 
    let combination = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 0]]; // победная комбинация
    let res = [true, true]; // флаг выигрыша
    for (let player = 0; player < 2; player++) {
      for (let i = 0; i < 4; i++) { // проходим по всему полю
        for (let j = 0; j < 4; j++) {
          if (combination[i][j] != this.state[player][i][j]) { // если хотя бы одна клетка не совпала по значению с выигрышной комбинацией
            res[player] = false; // флаг победы = false 
          }
        }
      }
    }
    for (let i=0; i<2; i++){
      if (res[i] == true){
        return i;
      }
    }
    return -2; // никто не выиграл
  }

  mix(count) { // перемешать count клеток доски
    let x, y; // заготовка под координаты клеток
    for (let i = 0; i < count; i++) { // делаем count раз
      let nullCell = this.getNullCell(); // находим координату "незаполненной" клетки
      let verticalMove = getRandomBool(); // какое делаем смещение (True - вертикальное, False - горизонтальное)
      let upLeft = getRandomBool(); // делаем смещение в какое направление (True - вверх если вертикальное/влево если горизонтальное, False - вниз, если вертикальное/вправо если горизонтальное)

      if (verticalMove) { // если делаем вертикальное движение
        x = nullCell.x; // фиксируем позицию по оси X "незаполненной" клетки
        if (upLeft) { // делаем смещение в определённое направление
          y = nullCell.y - 1; // фиксируем позицию по оси Y, куда сместиться "незаполненная" клетка
        } else {
          y = nullCell.y + 1; // фиксируем позицию по оси Y, куда сместиться "незаполненная" клетка
        }
      } else { // если движение горизонтальное
        y = nullCell.y; // фиксируем позицию по оси Y "незаполненной" клетки
        if (upLeft) {
          x = nullCell.x - 1; // фиксируем позицию по оси X, куда сместиться "незаполненная" клетка
        } else {
          x = nullCell.x + 1; // фиксируем позицию по оси X, куда сместиться "незаполненная" клетка
        }
      }

      if (0 <= x && x <= 3 && 0 <= y && y <= 3) { // если полученное смещение входит в рамки доски, делаем его
        this.move(x, y); // меняем клетки/значения (x, y) и (nullCell.x, nullCell.y) местами
      }
    }

    this.clicks = 0; // число ходов = 0 (перезапись из-за изменения после вызова mix)
  }
}



// function setOnlineBoard(board) {
// 	Game.state = board // выстановка state для игры по значению переданного поля
// }



window.onload = function(){ // как будет грузится окно
  let canvas = document.getElementById("canvas"); // получение элемента html страницы по ID "canvas"
  canvas.width  = 0.25 * window.screen.width; // отражающий HTML-атрибут ширины элемента <canvas>, интерпретируемый в пикселях CSS
  canvas.height = 0.25 * window.screen.width; // отражающий HTML-атрибут высоты элемента <canvas>, интерпретируемый в пикселях CSS

  let context = canvas.getContext("2d"); // возвращает контекст рисования на холсте или значение null, если идентификатор контекста не поддерживается или холст уже установлен в другой режим контекста
  context.fillRect(0, 0, canvas.width, canvas.height); // метод Canvas 2D API рисует прямоугольник, по координатам x=0, y=0, шириной=canvas.width, высотой=canvas.height

  let cellSize = canvas.width / 4; // определяем размер клетки поля (на 4 клетки)

  game = new Game(context, cellSize, randomState = config.randomState); // создание объекта Game на основе контекста в html и параметра cellSize
  game.mix(config.mix_count);
  game.null_cell = game.getNullCell(); // на случай, если mix_count = 0
  game.draw();


  ws.onmessage = function(e) { // определяем, что будет выполнятся при получении сокетом(сервером) информации - будет вызываться функция, что выполнится (на вход - событие e)
    response = JSON.parse(e.data);  // парсим (преобразуем) полученные данные (.data) из ивента 'e' в json объект
    console.log("Got message:", response); // для отладки выводим в консоль браузера полученные данные из ивента
    player_id_html = document.getElementById("current-player");
    info_html = document.getElementById("info");
    
    if (response["state"] == "Host joined") {
      console.log("Host joined");
      player_id = response["player_id"];
      player_id_html.innerHTML = player_id;
      ws.send(JSON.stringify({ // отправляем данные о новой созданной доске
        'state': "created new board",
        'board': game.state,
        'whose_move': response['whose_move'],
        'message': 'Board creation complete',
        'clicked_cell': response['clicked_cell'],
        'clicks' : game.clicks,
        'completion': response['completion'],
        'player_id': response['player_id'],
        'null_cell': game.null_cell,
      }));
    } else if (response["state"] == "Player 0 joined") {
      if (player_id === null){
        player_id = response["player_id"];
        player_id_html.innerHTML = player_id;
      }
    } else if (response["state"] == "Everyone joined") { //проверка на то, что все игроки зашли
      if (player_id === null){
        player_id = response["player_id"];
        player_id_html.innerHTML = player_id;
      }

      whose_move = response["whose_move"];
      console.log('whose_move', whose_move);

      game.state = response["board"]; // берём из полученного event.data значения на доске
      game.draw();
    } else if (response["state"] == 'Update view') {
      repaintAfterMove(response["clicked_cell"][0], response["clicked_cell"][1]);
      whose_move = response["whose_move"];
    } else { // дефолтовый варинт, если ничего не сработало
      console.log(response["state"]);
    }
    info_html.innerHTML = response["message"]; // отображение дополнительной информации

    if (game.victory() == player_id) { // если кто-то выиграл
      alert("Player " + player_id + " won the game in " + game.getClicks()+" clicks!"); // победившему выводится оповещение
      ws.send(JSON.stringify({
        'state': "victory",
        'board': game.state,
        'whose_move': whose_move,
        'message': 'Player ' + player_id + ' won the game',
        'clicked_cell': [x, y], // так как это не индексы, а отступы от границ (всё наоборот)
        'clicks' : game.clicks,
        'completion': completion,
        'player_id': player_id,
        'null_cell': Null,
      }));
      game.draw();
    }

  };

  canvas.onclick = function(e) { // обработка события e (нажатие на элемент canvas на html странице левой кнопкой мыши)
    if (whose_move != player_id) // если нет возможности хода, просто выход
    {
      return;
    }

    let x = (e.pageX - canvas.offsetLeft) / cellSize | 0; // отступ от левой границы (столбец)
    let y = (e.pageY - canvas.offsetTop)  / cellSize | 0; // отступ от верхней границы (строка)
    // Свойство HTMLElement.offsetLeft, доступное только для чтения, возвращает число пикселей, на которое левый верхний угол текущего элемента смещен влево в узле HTMLElement.offsetParent. Для элементов уровня блока offsetTop, offsetLeft, offsetWidth и offsetHeight описывают рамку элемента относительно offsetParent.
    onEvent(x, y); // обработка нажатия на клетку x, y
  };

  function onEvent(x, y) { // при нажатии на ячейку (x, y)
    let Null = game.null_cell; // сохранение значение "незакрашенной" клетки перед движением
    if (game.move(x, y)) { // делаем move, если он возможен - отправляем новые данные на сервер
      game.draw();
      console.log('Игрок: ' + player_id + " нажал ячейку: " + x, y); // вывод лога об этом

      ws.send(JSON.stringify({
        'state': "moved",
        'board': game.state,
        'whose_move': whose_move,
        'message': 'Player ' + player_id + ' clicked cell ' + x + " " + y,
        'clicked_cell': [x, y], // так как это не индексы, а отступы от границ (всё наоборот)
        'clicks' : game.clicks,
        'completion': completion,
        'player_id': player_id,
        'null_cell': Null,
      }));
    }
  };
}

function repaintAfterMove(x, y)
{
  game.move(x, y); // делаем move клетки (x,y) с "незаполненной" клеткой рядом
  let context = canvas.getContext("2d"); // берём контекст
  context.fillRect(0, 0, canvas.width, canvas.height); // метод Canvas 2D API рисует прямоугольник, по координатам x=0, y=0, шириной=canvas.width, высотой=canvas.height (пересоздаём поле)
  game.draw();
}