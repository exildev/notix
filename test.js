var listening = require('./listening');

listening.setup(function (){
	listening.reset();
	listening.add_session('User', 'admin', 'session_id1', 'socket_id1', function(session){
		listening.add_messages_by_type('User', {'message': 'message1'}, function(django_id, socket_id, message){
			console.log(django_id, socket_id, message);
			listening.visit_message(message._id, function(){
				listening.delete_message(message._id);
				listening.delete_session(session.type, session.webuser, session.sessions[0].session_id, session.sessions[0].socket_id);
			})
		});
	});
});


