let game = {
  socket : io(),
  waitCotainer:null,
  coinContainer:null,
  toastContainer:null,
  gameContainer:{
    infoPanelContainer:null,
    gridContainer:null
  },
  resultContainer:null,
  player : {
    id:'',
    symbol:'',
    isPaired:false,
    isMyTurn: false,
    lastMove:{},
    moves : []
  },
  opponent : {
    id:'',
    symbol:'',
    isPaired:false,
    isMyTurn: false,
    lastMove:{},
    moves : []
  },
  gameOver:false,
  showTurnMessage(){
    let turn = '';
    if(this.player.isMyTurn){
      turn = `Its your turn!`;
    }else{
      turn = `Its opponent's turn!`;
    }
    this.showToast(turn);
    let turnContainer = this.gameContainer.infoPanelContainer.querySelector('.info-turn');
    turnContainer.innerHTML = turn;
  },
  handleBroadCast(broadcast){
    switch (broadcast.type) {
      case "toast":
        this.showToast(broadcast.message,broadcast.sticky);
        break;
      case "wait":
        this.showWait();
        break;
      case "coin":
        this.showCoin();
        break;
      case "player_id":
        this.player.id = broadcast.id;
        break;
      case "player_sign":
        this.player.symbol = broadcast.sign;
        break;
      case "opponent_id":
        this.opponent.id= broadcast.id;
        break;
      case "opponent_sign":
        this.opponent.symbol = broadcast.sign;
        let symbolsContainer = this.gameContainer.infoPanelContainer.querySelector('.info-symbols');
        symbolsContainer.innerHTML = `(${this.player.symbol}) you  | (${this.opponent.symbol}) opponent `;
        console.log("opponent symbol recieved");
        break;
      case "set_paired":
        this.opponent.isPaired = broadcast.isPaired;
        this.player.isPaired = broadcast.isPaired;
        if(!broadcast.isPaired){
          this.hideAll();
          this.showToast("Game Over, Opponent is disconnected!",true);
        }else{
          this.showToast("Game Started").then(()=>{
            this.showTurnMessage();
          });
          this.showGameCotrolls();
        }
        break;
      case "coin_result":
        this.player.isMyTurn = broadcast.turn;
        this.opponent.isMyTurn = !broadcast.turn;
        break;
      case "player_move_count":
        if(broadcast.counted){
          let move = broadcast.move;
          let cell = document.querySelector(`.cell-${move.row}${move.col}`);
          cell.innerHTML = this.player.symbol;
          this.player.isMyTurn = false;
          this.opponent.isMyTurn = true;
          this.showTurnMessage();
        }
        break;
      case "opponent_move_count":
        let move = broadcast.move;
        this.opponent.lastMove = move;
        let cell = document.querySelector(`.cell-${move.row}${move.col}`);
        cell.innerHTML = this.opponent.symbol;
        this.opponent.isMyTurn = false;
        this.player.isMyTurn = true;
        this.showTurnMessage();
        break;
      case "result":
        if(!this.gameOver){
          this.gameOver = true;
          this.player.isMyTurn = false;
          this.opponent.isMyTurn = false;
          let resultTextContainer = this.resultContainer.querySelector('.result-text');
          if(broadcast.disconnected){
            resultTextContainer.innerHTML = "Aah! Your opponent quit the game";
          }else if(broadcast.tie){
            resultTextContainer.innerHTML = "Aah! Its a tie...";
          }else if(broadcast.won){
            resultTextContainer.innerHTML = "CONGRATULATIONS! Your victory...";
          }else{
            resultTextContainer.innerHTML = "Oops! You lose...";
          }
          this.resultContainer.style.display = "block";
        }
      default:
    }
  },
  isValidMove(position){
    if(!this.player.isMyTurn){
      return false;
    }else{
      let allowed = true;
      [...this.player.moves,...this.opponent.moves].forEach(p => {
        if(p.row === position.row && p.col === position.col){
          allowed = false;
        }
      });
      if(allowed){
        this.opponent.isMyTurn = false;
        this.player.isMyTurn = false;
      }
      return allowed;
    }
  },
  markMove(index,r,c){
    this.player.lastMove = {row:r,col:c};
    let gridCell = this.gridItems[index];
    if(this.isValidMove(this.player.lastMove)){
      this.socket.emit('command',{type:'move', move:this.player.lastMove});
    }else{
      this.showToast('Move not allowed!');
    }
  },
  showToast(msg,sticky=false){
    return new Promise((resolve,reject)=>{
      this.toastContainer.innerHTML = msg;
      let toastStyle = this.toastContainer.style;
      toastStyle.display = "block";
      if(!sticky){
        toastStyle.opacity = 1;
        (function fade(){(toastStyle.opacity-=.01) < 0 ? toastStyle.display="none" : setTimeout(fade,40)})();
      }
      return resolve(true);
    });
  },
  hideAll(){
    return new Promise((res,rej)=>{
      let styles = [
        this.waitCotainer.style,this.coinContainer.style,
        this.gameContainer.infoPanelContainer.style,
        this.gameContainer.gridContainer.style,
        this.toastContainer.style
      ];
      styles.forEach((style)=> style.display = "none" );
      res(true);
    });
  },
  showWait(){
    this.hideAll().then(()=>{
      let style = this.waitCotainer.style;
      style.display = "block";
    });
  },
  showCoin(){
    this.hideAll().then(()=>{
      let style = this.coinContainer.style;
      style.display = "block";
    });
  },
  showGameCotrolls(){
    console.log('showGameCotrolls');
    this.hideAll().then(()=>{
      let panelStyle = this.gameContainer.infoPanelContainer.style;
      let gridStyle = this.gameContainer.gridContainer.style;
      panelStyle.display = "block";
      gridStyle.display = "block";
      this.player.moves = [];
      this.opponent.moves = [];
    });
  },
  gridItems:[],
  init(){
    this.waitCotainer = document.querySelector("div.wait");
    this.coinContainer = document.querySelector("div.toss");
    this.toastContainer = document.querySelector("div.toast");
    this.gameContainer.infoPanelContainer = document.getElementById("info-panel");
    this.gameContainer.gridContainer = document.getElementById("grid");
    this.resultContainer = document.querySelector('div.result');
    this.socket.on('broadcast', (broadcast)=>{
      console.log(broadcast);
      this.handleBroadCast(broadcast);
    });
    let items = document.getElementById('grid').getElementsByClassName('grid-item');
    for(let index=0; index < items.length; index++){
        let gridCell = items[index];
        gridCell.onclick = ()=> {
          this.markMove(index,gridCell.dataset.row,gridCell.dataset.col);
        };
        this.gridItems.push(gridCell);
    }
  }
};
game.init();
