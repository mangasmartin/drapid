const WebSocket = require('ws');
//const md5 = require('crypto-js/md5');
const wss = new WebSocket.Server({ port: process.env.PORT || 4000 });
let rooms = [];

wss.on("connection", function (ws,req) {
  if (req.headers.origin === "https://dinami.cat"){
    //set random num id room
    let room, pass, key, connec = false;
    if (req.url == "/create"){
      room = randomNum(1000,9999);
      //room = 1000; //luego quitar
      while (rooms[room]){
        room ++;
        if (room > 9999) room = 1000;
      }
      rooms[room] = [];
      let data = { type: "created", room: room };
      ws.send(JSON.stringify(data));
      connec = true;
    } else {
      room = req.url.substr(1); //Toma el room como carpeta de la url.
                                //Habrá que hacer un htaccess
                                //Esto si habilito finalmente el acceso por enlace, sino el htaccess no hará falta
      if (!isNaN(room) && rooms[room]){
        let data = { type: "connected" };
        ws.send(JSON.stringify(data));
        rooms[room][0].send(JSON.stringify(data)); //Notificación al Admin
        connec = true;
      } else {
        let data = { type: "refused" };
        ws.send(JSON.stringify(data));
        ws.close();
      }
    }

    if (connec){
      ws.room = room;
      ws.id = req.headers['sec-websocket-key'];
      rooms[room].push(ws);
    }

    ws.on("message", function(d,isBinary){
      const data = isBinary ? d : JSON.parse(d.toString()); //Corrección por versión
      //let data = JSON.parse(d); //d.msg?

      if (!data.id){
        wss.broadcast(ws.room, ws.id, d);
      } else {
        if (data.id == "") data.id = rooms[ws.room][0].id;
        wss.sendTo(ws.room, ws.id, data.id, data.resp);
      }
    });
    
    ws.on("close", function(code,data){
      const reason = data.toString();
      if (rooms[room]){
        if (rooms[ws.room][0].id == ws.id){
          wss.broadcast(ws.room, ws.id, JSON.stringify({ type: "end" }));
          rooms[ws.room] = null;
        } else {
          let i = rooms[ws.room].indexOf(ws.id);
          rooms[ws.room].splice(i,1);
        }
      }
    });

  } else {
    ws.close();
  }
});

function randomNum(min, max, last){
  //min: min number (Optional)
  //max: max number (Mandatory)
  //last: last number used: if it's set it avoids repetition only for next number (Optional)
  if (!min) min = 0;
  if (min >= max) return min;
  var n = Math.round(Math.random() * (max - min)) + min;
  if (last){
    if (n == last){
      n ++;
      if (n > max) n = min;
    }
  }
  return n;
}

wss.sendTo = function(r,sid,rid,d){
  for (var c = 0; c < rooms[r].length; c++){
    var client = rooms[r][c];
    if (client.id == rid && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "direct", sender: sid, msg: d }));
      break;
    }
  }
}

wss.broadcast = function(r,id,data){
  for (var c = 0; c < rooms[r].length; c++){
    var client = rooms[r][c];
    if (client.id !== id && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

wss.broadcastAll = function(r,data){
  for (var c = 0; c < rooms[r].length; c++){
    var client = rooms[r][c];
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
