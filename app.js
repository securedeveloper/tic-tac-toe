var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname+'/index.html');
});

app.use('/public',express.static(__dirname+'/public/'));

/* Game */
var Player = ()=>{
  max = 10;
  min = 1;
  return {
    id : Math.floor(Math.random() * (max - min + 1)) + min,
    isConnected : false,
    socket : null,
    playerId : '',
    playerSign : '',
    moves : []
  };
};
var game = {
  /* Checking socket status */
  isSocketEmpty(socket) {
    return (socket == null || socket == undefined || socket.disconnected);
  },
  /* If any player quit by any reason disconnect him */
  abortGame() {
    if(this.isSocketEmpty(this.PLAYERS.player.socket)){
      console.log('1st player quit the game!');
      this.PLAYERS.player.isConnected = false;
      if(!this.isSocketEmpty(this.PLAYERS.opponent.socket))
        this.sendBroadCast(this.PLAYERS.opponent.socket,{type:'result',disconnected:true,tie:false,won:false});
    }else if(this.isSocketEmpty(this.PLAYERS.opponent.socket)){
      console.log('2nd player quit the game!');
      this.PLAYERS.opponent.isConnected = false;
      if(!this.isSocketEmpty(this.PLAYERS.player.socket))
        this.sendBroadCast(this.PLAYERS.player.socket,{type:'result',disconnected:true,tie:false,won:false});
    }
    /* If we want to connect with any waiting player, after connection drop, Automatoc fallback  */
    /*
    if(WAITING_LIST.length > 0){
      if(this.PLAYERS.player.socket == null){
        this.PLAYERS.player = this.Player();
        this.setConnection(this.WAITING_LIST[0],this.PLAYERS.player)
      }else{
        this.PLAYERS.opponent = this.Player();
        this.setConnection(this.WAITING_LIST[0],this.PLAYERS.opponent)
      }
      this.WAITING_LIST.splice(0, 1);
    }
    */
  },
  /* checking for duplicate moves, if user sent new move that was already marked */
  containsMove(move, moves) {
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].row == move.row && moves[i].col == move.col) {
        return true;
      }
    }
    return false;
  },
  /* Start Game */
  startGame() {
    this.sendToastMessage(this.PLAYERS.player.socket,'A player joined you!');
    this.sendToastMessage(this.PLAYERS.opponent.socket,'A player joined you!');
    this.sendOpponent(this.PLAYERS.player,this.PLAYERS.opponent);
    this.sendCoinSignal(this.PLAYERS.player.socket);
    this.sendCoinSignal(this.PLAYERS.opponent.socket);
    setTimeout(()=>{
      //if current milliseconds are even, it's 1st player turn, otherwise.
      if(new Date().getTime()%2 == 0){
        this.sendBroadCast(this.PLAYERS.player.socket,{type:'coin_result',turn:true});
        this.sendBroadCast(this.PLAYERS.opponent.socket,{type:'coin_result',turn:false});
      }else{
        this.sendBroadCast(this.PLAYERS.player.socket,{type:'coin_result',turn:false});
        this.sendBroadCast(this.PLAYERS.opponent.socket,{type:'coin_result',turn:true});
      }
      /* sending pair flag to let both players knw that game is ready */
      this.sendBroadCast(this.PLAYERS.player.socket,{type:"set_paired",isPaired:true});
      this.sendBroadCast(this.PLAYERS.opponent.socket,{type:"set_paired",isPaired:true});
    },2000);
  },
  /* Check if win sequence match */
  winMove(moves){
    /* 01. Check Row Wise */
    for (let row = 1; row <= 4; row ++) {
      let matchedRows = moves.filter(x => x.row == row);
      if(matchedRows.length > 0){
        for(let col=1;col<=2;col++){
          if(
            (matchedRows.filter(r=> r.col == col).length>0) &&
            (matchedRows.filter(r=> r.col == col+1).length>0) &&
            (matchedRows.filter(r=> r.col == col+2).length>0)
          ){
            //Win move matched
            return true;
          }
        }
      }
    }
    /* 02. Check Col Wise */
    for (let col = 1; col <= 4; col ++) {
      let matchedCols = moves.filter(x => x.col == col);
      if(matchedCols.length > 0){
        for(let row=1;row<=2;row++){
          if(
            (matchedCols.filter(r=> r.row == row).length>0) &&
            (matchedCols.filter(r=> r.row == row+1).length>0) &&
            (matchedCols.filter(r=> r.row == row+2).length>0)
          ){
            //Win move matched
            return true;
          }
        }
      }
    }
    /* 03. Check Diagonal match */
    /* left to right Diagonal */
    for(let row=1; row <= 2; row++){
      if(
        (
          (moves.filter(x => x.row == row).length > 0) &&
          (moves.filter(x => x.col == 1 && x.row == row).length > 0) &&
          (moves.filter(x => x.col == 2 && x.row == row+1).length > 0) &&
          (moves.filter(x => x.col == 3 && x.row == row+2).length > 0)
        )
        ||
        (
          (moves.filter(x => x.row == row).length > 0) &&
          (moves.filter(x => x.col == 2 && x.row == row).length > 0) &&
          (moves.filter(x => x.col == 3 && x.row == row+1).length > 0) &&
          (moves.filter(x => x.col == 4 && x.row == row+2).length > 0)
        )
      ){
        return true;
      }
    }
    /* right to left Diagonal */
    for(let row=1; row <= 2; row++){
      if(
        (
          (moves.filter(x => x.row == row).length > 0) &&
          (moves.filter(x => x.col == 4 && x.row == row).length > 0) &&
          (moves.filter(x => x.col == 3 && x.row == row+1).length > 0) &&
          (moves.filter(x => x.col == 2 && x.row == row+2).length > 0)
        )
        ||
        (
          (moves.filter(x => x.row == row).length > 0) &&
          (moves.filter(x => x.col == 3 && x.row == row).length > 0) &&
          (moves.filter(x => x.col == 2 && x.row == row+1).length > 0) &&
          (moves.filter(x => x.col == 1 && x.row == row+2).length > 0)
        )
      ){
        return true;
      }
    }

    return false;
  },
  /* Handle Commands sent by players */
  handleCommand(socket,cmd) {
    let player = null;
    let opponent = null;
    if(socket.id === this.PLAYERS.player.playerId){
      console.log('cmd by 1st player');
      //1st player's commands
      player = this.PLAYERS.player;
      opponent = this.PLAYERS.opponent;
    }else{
      console.log('cmd by 2nd player');
      //2nd player's commands
      player = this.PLAYERS.opponent;
      opponent = this.PLAYERS.player;
    }
    console.log(cmd);
    switch (cmd.type) {
      case "move":
        if(this.containsMove(cmd.move,[...player.moves,...opponent.moves])){
          this.sendBroadCast(player.socket,{type:'player_move_count',counted:false});
          this.sendToastMessage(player.socket,'Invalid move!');
        }else{
          player.moves.push(cmd.move);
          this.sendBroadCast(player.socket,{type:'player_move_count',counted:true,move:cmd.move});
          this.sendBroadCast(opponent.socket,{type:'opponent_move_count',counted:true,move:cmd.move});
          //TODO CHECK WIN MOVE HERE
          var won = false;
          if(this.winMove(player.moves)){
            /* Player won */
            this.sendBroadCast(player.socket,{type:'result',disconnected:false,tie:false,won:true});
            this.sendBroadCast(opponent.socket,{type:'result',disconnected:false,tie:false,won:false});
            /* game ends */
            // this.PLAYERS = : {
            //   player : Player(),
            //   opponent: Player()
            // };
            console.log("Game Over, user won!");
          }else if([...player.moves,...opponent.moves].length >= 16){
            /* it's a tie, no further moved are allowed */
            this.sendBroadCast(player.socket,{type:'result',disconnected:false,tie:true ,won:false});
            this.sendBroadCast(opponent.socket,{type:'result',disconnected:false,tie:true,won:false});
            /* game ends */
            // this.PLAYERS = : {
            //   player : Player(),
            //   opponent: Player()
            // };
            console.log("Game Over, its a tie!");
          }
        }
        break;
      default:

    }
  },
  /* Boradcast to selected players */
  sendBroadCast(socket,broadcast) {
    socket.emit('broadcast',broadcast);
  },
  /* Initialize a players' connection */
  setConnection(socket,player) {
      player.socket = socket;
      player.playerId = socket.id;
      player.isConnected = true;
      this.sendBroadCast(player.socket,{type:"player_id",id:socket.id});
      this.sendBroadCast(player.socket,{type:"player_sign",sign:player.playerSign});
      this.sendWaitSignal(socket);
      player.socket.on('disconnect', ()=>{
        this.abortGame();
      });
      player.socket.on('command',(cmd)=>{
        this.handleCommand(socket,cmd);
      });
      if(!this.isSocketEmpty(this.PLAYERS.player.socket) && !this.isSocketEmpty(this.PLAYERS.opponent.socket)){
        this.startGame();
      }else{
        this.sendToastMessage(player.socket,'Waiting for other player to join!',true);
      }
  },
  /*  Opponent Info */
  sendOpponent(player,opponent) {
    this.sendBroadCast(player.socket,{type:"opponent_sign",sign:opponent.playerSign});
    this.sendBroadCast(opponent.socket,{type:"opponent_sign",sign:player.playerSign});
    this.sendBroadCast(player.socket,{type:"opponent_id",id:opponent.socket.id});
    this.sendBroadCast(opponent.socket,{type:"opponent_id",id:player.socket.id});
  },
  /* Wait Signal */
  sendWaitSignal(socket) {
    this.sendBroadCast(socket,{type:'wait'});
  },
  /* Toast message */
  sendToastMessage(socket,message,sticky=false) {
    this.sendBroadCast(socket,{type:'toast',message:message,sticky:sticky});
  },
  /* Inform about tossing */
  sendCoinSignal(socket) {
    this.sendBroadCast(socket,{type:'coin'});
  },
  /* Player Collection */
  PLAYERS : {
    player : Player(),
    opponent: Player()
  },
  /* Waiting list, extra players to be put on waiting list */
  WAITING_LIST : [],
  handleWaitingList(socket){
    this.sendBroadCast(socket,{type:'wait'});
    this.sendBroadCast(socket,{type:'toast',message:'Table is full now , you have to wait!',sticky:true});
    this.WAITING_LIST.push(socket);
    console.log(this.WAITING_LIST.length+' players are waiting for their turn ...');
    socket.on('disconnect',()=>{
      for(let i = this.WAITING_LIST.length - 1; i >= 0; i--) {
        if(this.WAITING_LIST[i].id === socket.id) {
           this.WAITING_LIST.splice(i, 1);
        }
      }
    });
  }
}

/* Communication with Players */
io.on('connection', (socket)=>{
  if(!game.PLAYERS.player.isConnected){
    /* 1st Player Joined */
    game.PLAYERS.player.playerSign = '&#10004;';
    game.setConnection(socket,game.PLAYERS.player);
    console.log('1st player join the Game!');
  }else if(!game.PLAYERS.opponent.isConnected){
    /* 2nd Player Joined */
    game.PLAYERS.opponent.playerSign = '&#10008;';
    game.setConnection(socket,game.PLAYERS.opponent);
    console.log('2nd player join the Game!');
  }else{
    /* Two players are already playing, put new player on waiting listing */
    game.handleWaitingList(socket);
  }
});

http.listen(3000, ()=>{
  console.log('Listening on localhost:3000');
});
