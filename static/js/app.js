
var actions = new Actions();

// Create WebSocket connection.
var wsProtocol = 'ws://';
if (window.location.protocol === 'https:') {
    wsProtocol = 'wss://';
}
const socket = new WebSocket(wsProtocol+window.location.host+'/ws/');
var myinfo = {
    kunjika: "",
    name: ""
};
var vayakti = {};
var typing = [];
var no_name_message = false;

// Connection opened
socket.addEventListener('open', function (event) {
    $('#progress_button').removeClass('is-hidden');

    var params = window.location.search;
    params = params.substr(1,params.length).split('&');
    
    if(params.length < 3) {
        State.hideProgress();
        return;
    }

    var frm = $('form[name=kaksh_sec]');
    frm.find('[name=kaksh_kunjika]').val(params[0]);
    frm.find('[name=kunjika]').val(params[1]);
    frm.find('[name=name]').val(params[2]);
    
    connect(frm);
});

// Listen for messages
socket.addEventListener('message', function (event) {
    var j = JSON.parse(event.data);
    switch(j.cmd) {
        case 'resp':
            if(j.result == 'Err') {
                if($('#chat_panel').hasClass('is-hidden')) {
                    $('[name="error_msg"]').text(j.message);
                    $('[name="error_msg"]').removeClass('is-hidden');
                    State.hideProgress();
                    actions.clear_key('join');
                } else {
                    Messages.pushStatus(j.message);
                }
            } else if(j.result == 'Ok'){
                actions.execute();
            }
            break;
        case 'kunjika':
            myinfo.kunjika = j.kunjika;
            break;
        case 'random':
            actions.execute();
            actions.clear_key('join');
            $('#next_btn').removeClass('is-hidden');
            no_name_message = true;
            Messages.pushStatus('Say hi to '+j.name);
            break;
        case 'status':
            if(j.status == "typing") {
                typing.push(j.kunjika);
                Messages.pushTypingStatus();
            } else if(j.status == "typing_end") {
                const index = typing.indexOf(j.kunjika);
                if (index > -1) typing.splice(index, 1);
                Messages.pushTypingStatus();
            }
            break;
        case 'text':
            Messages.pushMessage(j.kunjika, j.text, j.reply, j.msg_id);
            break;
        case 'connected':
            vayakti[j.kunjika] = j.name;
            if(!$('#vayakti_model').hasClass('.is-hidden')) refreshVayaktiList();
            Messages.pushStatus('Vyakti '+j.name+' connected as '+j.kunjika.substr(0,8)+' at '+Messages.currentTime());
            break;
        case 'disconnected':
            delete vayakti[j.kunjika];
            if(!$('#vayakti_model').hasClass('.is-hidden')) refreshVayaktiList();
            Messages.pushStatus('Vyakti '+j.name+' disconnected as '+j.kunjika.substr(0,8)+' at '+Messages.currentTime());
            break;
        case 'left':
            myinfo.kunjika = '';
            myinfo.name = '';
            State.login();
            break;
        case 'list':
            JSON.parse(j.vayakti).forEach(function(usr) {
                vayakti[usr[0]] = usr[1];
            });
            break;
    }
});

function connect(frm) {
    if(actions.has_key('join') || actions.has_key('leave')) return;
    var frm = $(frm);
    var data = {};
    frm.serializeArray().forEach(el => {
        if(typeof el.value == 'string')
            data[el.name] = el.value.trim();
        else
            data[el.name] = el.value;
    });

    if(data['length'] !== undefined) {
        data['length'] = parseInt(data['length']);
    }

    actions.add('join', function() {
        Messages.cleanMessage();
        myinfo.name = data.name;
        no_name_message = false;
        joining = false;
        vayakti = [];
        typing = [];
        State.chat();
        State.hideProgress();
        Messages.pushStatus('Connected as '+data.name+' at '+Messages.currentTime());
        socket.send(JSON.stringify({cmd: 'list'}));
    })

    data = Object.assign({cmd: frm.attr('cmd')}, data);
    socket.send(JSON.stringify(data));
}

function connect_next() {
    if(actions.has_key('join') || actions.has_key('leave')) return;
    State.showProgress();
    actions.add('join', function() {
        Messages.cleanMessage();
        State.chat();
        vayakti = [];
        typing = [];
        State.hideProgress();
        Messages.pushStatus('Connectedas '+data.name+' at '+Messages.currentTime());
        socket.send(JSON.stringify({cmd: 'list'}));
    });
    socket.send(JSON.stringify({ cmd: 'randnext' }));
}

function leave() {    
    if(actions.has_key('leave')) return;
    actions.clear();
    actions.add('leave', function() {
        myinfo.kunjika = '';
        myinfo.name = '';
        State.login();
        State.hideProgress();
    });
    socket.send(JSON.stringify({cmd: 'leave'}));
}

function sendTyping() {
    socket.send(JSON.stringify({
        cmd: 'status',
        status: 'typing'
    }));
}

function sendTypingEnd() {
    socket.send(JSON.stringify({
        cmd: 'status',
        status: 'typing_end'
    }));
}

function send() {
    var text = $('#send_box').val().trim();
    if(text.length == 0) return;
    socket.send(JSON.stringify({
        cmd: "text",
        text: text,
        reply: $('#reply_clip').attr('msg')
    }));
    $('#send_box').val('');
    $('#reply_clip').attr('msg', '');
    $('#reply_clip').addClass('is-hidden');
    $('#reply_clip > span').text('');
    autosize($('#send_box')[0]);
}

function vayaktiList() {
    refreshVayaktiList();
    $('#vayakti_model').removeClass('is-hidden');
    $('#action_clip').addClass('is-hidden');
}

function changeColor() {
    $('body').toggleClass('dark')
    $('#action_clip').addClass('is-hidden');
}

function refreshVayaktiList() {
    var v = $('#vayakti_list');
    v.empty();
    Object.keys(vayakti).forEach((key) => {
        v.append($('<tr>')
            .append($('<td>').append(vayakti[key]))
            .append($('<td>').append(key)));
    });
}
           
function autosize(el){
    setTimeout(function(){
        el.style.cssText = 'height:auto; padding:0';
        el.style.cssText = 'height:' + el.scrollHeight + 'px';
        $('#reply_clip').css('bottom',  (el.scrollHeight + 10) + 'px');
        $('#selected_clip').css('bottom',  (el.scrollHeight + 10) + 'px');
    },0);    
}

// Camera
var video = $('#videoElement')[0];
if (navigator.mediaDevices.getUserMedia) {
navigator.mediaDevices.getUserMedia({ video: true, width: {max: 100} })
    .then(function (stream) {
    video.srcObject = stream;
    })
    .catch(function (error) {
    console.log('Something went wrong!');
    });
}

var resultb64='';
function capture() {        
    var canvas = $('<canvas>')[0];     
    var video = $('#videoElement')[0];
    canvas.width = 200;
    canvas.height = 200;
    canvas.getContext('2d').drawImage(video, 0, 0, 120,120);  
    resultb64=canvas.toDataURL();
    socket.send(JSON.stringify({
        cmd: 'text',
        text: resultb64,
        reply: ''
    }));
}
