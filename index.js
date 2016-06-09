var http = require('http');
var server = http.createServer();
var io = require('socket.io')(server);
var session = require('./session');
var listening = require('./listening');
var url = require('url');
var request = require('request');
var verifing = {};
	
io.on('connection', function(socket){
	////console.log('a user connected');

	socket.on('identify', function(message){
		var django_id = message['django_id'];
		var usertype = message['usertype'];

		var ID = session.get_session(django_id, usertype);
		//console.log('Identify: ', django_id, usertype, ID);
		socket.emit('identify', {"ID": ID});
		if (ID){
			session.clear(django_id, usertype);
			if (usertype == 'WEB'){
				var django_id = ID['django_id'];
				var webuser = ID['webuser'];
				var usertype = ID['usertype'];
				var username = ID['username'];
				var password = ID['password'];
				var type = ID['type'];
				//console.log(type, webuser);
				var messages = listening.get_messages(type, webuser);
				//console.log(messages);
				for (var i in messages) {
					//socket.emit('notix', messages[i]);
				}
			}
		}
	});


	socket.on('login', function(message){
		////console.log('Login: ', message);
		var django_id = message['django_id'];
		var webuser = message['webuser'];
		var usertype = message['usertype'];
		var username = message['username'];
		var password = message['password'];

		if (usertype == 'WEB'){
			verifing[django_id] = socket.id;
			request('http://192.168.0.109:1190/notificaciones/verify/' + django_id + '/', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var data = JSON.parse(body);
					if (data.socket_id == socket.id){
						session.login(django_id, username, password, usertype, function (success){
							if (success){
								session.set_value(django_id, 'type', data.type, usertype);
								session.set_value(django_id, 'webuser', data.webuser, usertype);
								listening.add_session(data.type, webuser, django_id, socket);
								socket.on('disconnect', function(){
									listening.delte_session(data.type, webuser, django_id, socket.id);
								});
								socket.emit('success-login');
							}else{
								socket.emit('error-login');
							}
						});
					}else{
						socket.emit('error-login');
					}
				}else
				console.log(error, response.statusCode);
			});
		}else {
			session.login(django_id, username, password, usertype, function (success){
				if (success){
					socket.emit('success-login');
				}else{
					socket.emit('error-login');
				}
			});
		}

	});


	socket.on('save', function(message){
		////console.log(message);
		var django_id = message['django_id'];
		var usertype = message['usertype'];
		var send_to = message['_send_to_'];
		var key = session.get_session(django_id, usertype);
		if (key){
			for (var to in send_to){
				listening.add_messages_by_type(send_to[to], [message], function(django_id, sockets, message){
					if (message['_visited_'].indexOf(django_id) < 0){
						for (var i in sockets){
							sockets[i].emit('notix', message);
						}
					}
				});
			}
		}
	});

	socket.on('visited', function(message){
		var django_id = message['django_id'];
		var usertype = message['usertype'];
		var webuser = message['webuser'];
		var message_id = message['message_id'];
		var type = message['type'];
		var key = session.get_session(django_id, usertype);
		if (key){
			console.log('visiting', django_id, usertype);
			listening.visit_message(type, webuser, message_id, django_id, function (session_id, sockets, message_id){
				for (var i in sockets){
					sockets[i].emit('visited', {'session_id': session_id, 'message_id': message_id});
				}
			});
		}
	});

	socket.on('messages', function(message){
		var django_id = message['django_id'];
		var usertype = message['usertype'];
		var webuser = message['webuser'];
		var type = message['type'];
		var key = session.get_session(django_id, usertype);
		if (key){
			console.log('messages', django_id, usertype);
			var messages = listening.get_messages(type, webuser);
			for (var i in messages) {
				console.log(messages[i]['_visited_'], django_id, messages[i]['_visited_'].indexOf(django_id));
				if (messages[i]['_visited_'].indexOf(django_id) < 0){
					socket.emit('notix', messages[i]);
				}
			}
		}
	});
});

var verify = http.createServer(function(request, response) {
	response.setHeader('Content-Type', 'text/html');
	response.writeHead(200, {'Content-Type': 'text/plain'});
	var parts = url.parse(request.url, true);
	if (request.method == 'GET') {
		////console.dir(parts.query['data']);
		var socket_id = verifing[parts.query['data']];
		response.end(socket_id);
	}
	////console.log(request.method);
});




function hash(username, password, usertype){
	return new Buffer(username+'/'+password + '/' + usertype).toString('base64')
}

verify.listen(80, '0.0.0.0', function() {
	console.log("Corriendo en el puerto ", 80);
});

server.listen(1196, '0.0.0.0', function() {
	console.log("Corriendo en el puerto ", 1196);
});