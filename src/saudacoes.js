
/* ---------- saudacoes por horario + lembretes (PT/EN/JA/KO) ---------- */
// periodos pelo relogio LOCAL do aparelho (acompanha o fuso/pais do aparelho)
const PERIODOS=[[0,5,'mad'],[5,10,'cafe'],[10,12,'manha'],[12,14,'almoco'],[14,16,'tarde'],[16,18,'lanche'],[18,22,'noite'],[22,24,'coruja']];
const periodoDe=(h=new Date().getHours())=>(PERIODOS.find(p=>h>=p[0]&&h<p[1])||PERIODOS[1])[2];
const OI={ // palavra de saudacao [pt,en,ja,ko]
mad:['Boa madrugada','Late night','夜更かしですね','늦은 밤이에요'],cafe:['Bom dia','Good morning','おはようございます','좋은 아침이에요'],manha:['Bom dia','Good morning','おはようございます','좋은 아침이에요'],
almoco:['Boa tarde','Good afternoon','こんにちは','안녕하세요'],tarde:['Boa tarde','Good afternoon','こんにちは','안녕하세요'],lanche:['Boa tarde','Good afternoon','こんにちは','안녕하세요'],
noite:['Boa noite','Good evening','こんばんは','좋은 저녁이에요'],coruja:['Boa noite','Good night','こんばんは','좋은 밤이에요']};
const MSG={ // [pt,en,ja,ko]
cafe:[
['Bora tomar um café e ler um pouco?','Shall we grab a coffee and read a bit?','コーヒーを飲みながら少し読みませんか?','커피 한 잔 하면서 조금 읽어볼까요?'],
['Café na mão, HQ na tela: que tal começar o dia lendo?','Coffee in hand, comic on screen: start the day reading?','コーヒー片手にコミックで一日を始めませんか?','커피 한 손에 만화 한 편, 하루를 읽기로 시작해 볼까요?'],
['Manhã boa pra um capítulo antes de correr o dia. Vamos?','A great morning for a chapter before the day gets busy. Ready?','忙しくなる前に一話どうですか?','바쁜 하루가 시작되기 전에 한 화 어때요?'],
['Um capítulo com o café da manhã? Eu topo!','A chapter with breakfast? I\'m in!','朝ごはんと一緒に一話、どうでしょう?','아침 식사와 함께 한 화 어때요?']],
manha:[
['Fim de manhã tranquilo: dá tempo de ler um pouquinho?','Calm late morning: time for a little reading?','のんびりした午前中、少し読む時間はありますか?','여유로운 오전, 조금 읽을 시간 있나요?'],
['Que tal uma pausa de cinco minutinhos com uma HQ?','How about a five-minute break with a comic?','5分だけコミックで休憩しませんか?','만화와 함께 5분만 쉬어볼까요?'],
['Aquela história está te esperando. Vamos continuar?','That story is waiting for you. Shall we continue?','あの物語があなたを待っています。続きを読みましょう?','그 이야기가 기다리고 있어요. 이어서 읽을까요?']],
almoco:[
['Já almoçou? Bora ler algo assim?','Had lunch yet? Shall we read something?','お昼は食べましたか?何か読みましょうか?','점심 드셨어요? 뭐 좀 읽어볼까요?'],
['Hora do almoço! Um capítulo para acompanhar a sobremesa?','Lunchtime! A chapter to go with dessert?','お昼の時間です!デザートと一緒に一話どうですか?','점심시간이에요! 디저트와 함께 한 화 어때요?'],
['Barriga cheia, cabeça leve: hora de ler um pouco.','Full belly, light mind: time to read a bit.','お腹いっぱい、心は軽く。少し読みましょう。','배도 부르고 마음도 가볍게, 조금 읽어봐요.']],
tarde:[
['Boa tarde! Uma pausa para ler cai bem, não acha?','Good afternoon! A reading break sounds nice, right?','午後のひととき、読書休憩はいかがですか?','오후엔 읽기 휴식이 딱이죠?'],
['A tarde pede um capítulo. Vamos nessa?','The afternoon calls for a chapter. Let\'s go?','午後は一話の時間です。読みましょう?','오후엔 한 화가 필요해요. 가볼까요?'],
['Tira uns minutinhos para você e para a sua leitura.','Take a few minutes for yourself and your reading.','自分と読書のために少しだけ時間をとりましょう。','나와 독서를 위한 몇 분을 내봐요.']],
lanche:[
['Hora do lanche! Café, bolo e uma HQ?','Snack time! Coffee, cake and a comic?','おやつの時間!コーヒーとケーキとコミックはどう?','간식 시간! 커피, 케이크 그리고 만화 어때요?'],
['Fim de tarde pede um mangá e um lanchinho. Bora?','Late afternoon calls for manga and a snack. Shall we?','夕方はマンガとおやつ。読みましょうか?','늦은 오후엔 망가와 간식! 같이 읽을까요?'],
['Falta pouco pro fim do dia: que tal ler um capítulo agora?','The day is almost over: how about a chapter now?','一日の終わりまであと少し。今一話どうですか?','하루가 거의 끝나가요. 지금 한 화 어때요?']],
noite:[
['Boa noite! Hora de relaxar com uma boa leitura.','Good evening! Time to unwind with a good read.','こんばんは!いい本でゆっくりしましょう。','좋은 저녁이에요! 좋은 읽을거리로 쉬어가요.'],
['Dia encerrado? Então a noite é de HQ e mangá.','Day done? Then tonight is for comics and manga.','今日はもうおしまい?夜はコミックとマンガの時間です。','하루 끝났나요? 이제 밤은 만화와 망가의 시간이에요.'],
['Luz baixa, sossego e um bom capítulo. Vamos ler?','Dim light, quiet and a good chapter. Shall we read?','薄明かり、静けさ、そして良い一話。読みましょうか?','은은한 조명, 고요함, 그리고 좋은 한 화. 읽어볼까요?']],
coruja:[
['Já é tarde: vamos fazer um corujão de leitura hoje?','It\'s getting late: up for a reading night owl session?','夜も更けてきました。今夜は夜更かし読書にしましょうか?','밤이 깊었어요. 오늘은 올빼미 독서 어때요?'],
['Quem dorme cedo perde o capítulo! O que lemos hoje à noite?','Early sleepers miss the chapter! What are we reading tonight?','早寝すると続きを逃しますよ!今夜は何を読みましょう?','일찍 자면 이번 화를 놓쳐요! 오늘 밤엔 뭘 읽을까요?'],
['Mais um capítulo antes de dormir? Só mais um…','One more chapter before bed? Just one more…','寝る前にもう一話?あと一話だけ…','자기 전에 한 화만 더? 딱 한 화만…']],
mad:[
['Madrugada é hora do corujão! O que vamos ler nessa madrugada?','Midnight is owl time! What shall we read tonight?','真夜中はフクロウの時間!今夜は何を読みましょうか?','새벽은 올빼미의 시간! 오늘 밤엔 뭘 읽을까요?'],
['Silêncio total e uma HQ: a madrugada é sua. Vamos?','Total silence and a comic: the night is yours. Ready?','静寂とコミック。夜はあなたのもの。読みましょう?','고요함과 만화, 새벽은 당신의 것. 가볼까요?'],
['Ainda acordado? Então vamos de corujão e mais um capítulo.','Still up? Then let\'s do a night-owl run and one more chapter.','まだ起きていますか?夜更かしでもう一話どうぞ。','아직 깨어 있나요? 올빼미답게 한 화 더 가요.']]
};
// lembretes (notificacao + aviso dentro do app) [titulo,corpo] por faixa
const LEM={
manha:[
[['Hora de ler ☕','Time to read ☕','読書の時間 ☕','읽을 시간 ☕'],['Pega o café e vamos ler um pouquinho de HQ ou mangá?','Grab your coffee and read a little comic or manga?','コーヒーを持って、コミックやマンガを少し読みましょう?','커피 들고 만화 조금 읽어볼까요?']],
[['Um capítulo antes do dia começar','A chapter before the day starts','一日の始まりに一話','하루 시작 전 한 화'],['Seu momento de leitura chegou. Vamos?','Your reading moment is here. Shall we?','読書の時間です。読みましょう?','독서 시간이 왔어요. 읽을까요?']]],
almoco:[
[['Hora do almoço 🍽','Lunchtime 🍽','お昼の時間 🍽','점심시간 🍽'],['Vamos ler um pouco agora no almoço? Só uns minutinhos.','Shall we read a little now at lunch? Just a few minutes.','お昼休みに少し読みませんか?ほんの数分だけ。','점심시간에 조금 읽어볼까요? 잠깐이면 돼요.']],
[['Já almoçou? Bora ler!','Had lunch? Let\'s read!','お昼は食べた?読みましょう!','점심 드셨어요? 읽어요!'],['Estou passando para avisar que é hora de ler. Vamos?','Just stopping by to say it\'s reading time. Ready?','読書の時間だとお知らせに来ました。読みますか?','읽을 시간이라고 알려드리러 왔어요. 읽을까요?']]],
tarde:[
[['Pausa para ler 📖','Reading break 📖','読書休憩 📖','읽기 휴식 📖'],['Que tal um café e um pouco de HQ ou mangá agora?','How about a coffee and a little comic or manga now?','コーヒーとコミックかマンガはいかがですか?','커피 한 잔과 만화 한 편 어때요?']],
[['Hora de ler?','Time to read?','読む時間ですか?','읽을 시간?'],['Sua história está esperando por você.','Your story is waiting for you.','あなたの物語が待っています。','당신의 이야기가 기다리고 있어요.']]],
noite:[
[['Hora de relaxar 🌙','Time to unwind 🌙','リラックスタイム 🌙','쉬어갈 시간 🌙'],['Vamos ler algo antes de a noite acabar? Corujão liberado!','Shall we read something before the night ends? Night-owl mode on!','夜が終わる前に何か読みましょう?夜更かしOK!','밤이 가기 전에 뭐 좀 읽을까요? 올빼미 모드 ON!']],
[['Mais um capítulo? 🦉','One more chapter? 🦉','もう一話? 🦉','한 화 더? 🦉'],['O dia acabou e a leitura está só começando. Vamos?','The day is over and the reading is just starting. Ready?','一日は終わり、読書はこれから。読みましょう?','하루는 끝났고 독서는 이제 시작이에요. 읽을까요?']]]
};
const faixaLem=h=>h>=5&&h<12?'manha':h>=12&&h<14?'almoco':h>=14&&h<19?'tarde':'noite';
const LI=()=>{const i=LANGS.indexOf(LANG);return i<0?1:[0,1,2,3][i]};
let _ultMsg={};
function sorteiaMsg(per){const a=MSG[per],ul=_ultMsg[per];let i=Math.floor(Math.random()*a.length);if(a.length>1&&i===ul)i=(i+1)%a.length;_ultMsg[per]=i;return a[i][LI()]}
