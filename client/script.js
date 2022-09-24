var ws = new WebSocket("ws://localhost:8000/ws"); //<!--создание объекта веб сокета (подключаемся к серверу ws://localhost:8000/ws, по протоколу websocet, а не html; localhost можно заменить на адрес сервера в интернете/локальной сети)-->

let player_id = null // Нужно будет переедать id игрока при инициализирующем подключении
let currentPlayer = null  // чей ход в данный момент

let gameOver = false
let gameLoaded = false

function getRandomBool() {
  if (Math.floor(Math.random() * 2) === 0) {
    return true;
  }
}

function Game(context, cellSize){
  this.state = [
    [1,2,3,4],
    [5,6,7,8],
    [9,10,11,12],
    [13,14,15,0]
  ];
  
  this.color = "#FFB93B";

  this.context = context;
  this.cellSize = cellSize;

  this.clicks = 0;
}

function setOnlineBoard(board) {
	game.state = board
}

Game.prototype.getClicks = function() {
  return this.clicks;
};

Game.prototype.cellView = function(x, y) {
  this.context.fillStyle = this.color;
  this.context.fillRect(
    x + 1, 
    y + 1, 
    this.cellSize - 2, 
    this.cellSize - 2
  );
};

Game.prototype.numView = function() {
  this.context.font = "bold " + (this.cellSize/2) + "px Sans";
  this.context.textAlign = "center";
  this.context.textBaseline = "middle";
  this.context.fillStyle = "#222";
};

Game.prototype.draw = function() {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (this.state[i][j] > 0) {
        this.cellView(
          j * this.cellSize, 
          i * this.cellSize
        );
        this.numView();
        this.context.fillText(
          this.state[i][j], 
          j * this.cellSize + this.cellSize / 2,
          i * this.cellSize + this.cellSize / 2
        );
      }
	  else {
	  
	  }
    }
  }
};

Game.prototype.getNullCell = function(){
  for (let i = 0; i<4; i++){
    for (let j=0; j<4; j++){
      if(this.state[j][i] === 0){
        return {x: i, y: j};
      }
    }
  }
};

Game.prototype.move = function(x, y) {
  let nullCell = this.getNullCell();
  let canMoveVertical = (x - 1 == nullCell.x || x + 1 == nullCell.x) && y == nullCell.y;
  let canMoveHorizontal = (y - 1 == nullCell.y || y + 1 == nullCell.y) && x == nullCell.x;

  if (canMoveVertical || canMoveHorizontal) {
    this.state[nullCell.y][nullCell.x] = this.state[y][x];
    this.state[y][x] = 0;
    this.clicks++;
  }
};
  
Game.prototype.victory = function() {
  let combination = [[1,2,3,4], [5,6,7,8], [9,10,11,12], [13,14,15,0]];
  let res = true;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (combination[i][j] != this.state[i][j]) {
        res = false;
        break;
      }
    }
  }
  return res;
};

Game.prototype.mix = function(count) {
  let x, y;
  for (let i = 0; i < count; i++) {
    let nullCell = this.getNullCell();

    let verticalMove = getRandomBool();
    let upLeft = getRandomBool();

    if (verticalMove) {
      x = nullCell.x; 
      if (upLeft) {
        y = nullCell.y - 1;
      } else {
        y = nullCell.y + 1;
      }
    } else {
      y = nullCell.y; 
      if (upLeft) {
        x = nullCell.x - 1;
      } else {
        x = nullCell.x + 1;
      }
    }

    if (0 <= x && x <= 3 && 0 <= y && y <= 3) {
      this.move(x, y);
    }
  }

  this.clicks = 0;
};

window.onload = function(){
  let canvas = document.getElementById("canvas");
  canvas.width  = 0.25 * window.screen.width;
  canvas.height = 0.25 * window.screen.width;

  let context = canvas.getContext("2d");
  context.fillRect(0, 0, canvas.width, canvas.height);

  let cellSize = canvas.width / 4;

  game = new Game(context, cellSize);
  // game.mix(300);
  game.draw();

  gameLoaded = true;

  canvas.onclick = function(e) {
    let x = (e.pageX - canvas.offsetLeft) / cellSize | 0;
    let y = (e.pageY - canvas.offsetTop)  / cellSize | 0;
    onEvent(x, y);
    console.log("Была нажатаячейка:" + x, y)
    ws.send(JSON.stringify({player: 1, cell_x: x, cell_y: y }));
  };

  canvas.ontouchend = function(e) {
    let x = (e.touches[0].pageX - canvas.offsetLeft) / cellSize | 0;
    let y = (e.touches[0].pageY - canvas.offsetTop)  / cellSize | 0;

    onEvent(x, y);
  };  

  function onEvent(x, y) { 
    game.move(x, y);
    context.fillRect(0, 0, canvas.width, canvas.height);
    game.draw();
    if (game.victory()) {
      alert("Собрано за "+game.getClicks()+" касание!"); 
      game.mix(300);
      context.fillRect(0, 0, canvas.width, canvas.height);
      game.draw(context, cellSize);
    }
  }
}


ws.onmessage = function(e) { // определяем, что будет выполнятся при получении сокетом(сервером) информации - будет вызываться функция, что выполниться (на вход - событие e)
    response = JSON.parse(e.data)  // парсим (преобразуем) полученные данные (.data) из ивента 'e' в json объект
    console.log("On message",response); // для отладки выводим в консоль браузера полученные данные из ивента
	if (response.init) { //проверка на то, что сообщение инициализирующее (передано поле init=True)
        game.state = response.board
		let context = canvas.getContext("2d");
		context.fillRect(0, 0, canvas.width, canvas.height);
		game.draw()
		if (response.message != "Waiting for another player") {  // если сообщение в ответе отличается - значит, что подключился второй игрок и в зависимости отсокета, на который шла отправка - создаются записи о игроках
			console.log("Добро пожаловать в Веб-консоль");
        }
		
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