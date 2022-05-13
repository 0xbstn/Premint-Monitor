require("dotenv").config();
const axios = require('axios')
const { MongoClient, ClientSession } = require("mongodb");
const uri = process.env.MONGODB


var database

const Discord = require('discord.js');
const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES]
});

const synchronizeSlashCommands = require('discord-sync-commands');

synchronizeSlashCommands(client, [
    {
        name: 'premint',
        description: 'Premint Monitor',
        options: [
            {
                name: 'channel',
                description: 'Le salon dans lequel vous souhaitez envoyer les notifications',
                type: 1,
                options: [
                    {
                        name: 'channel',
                        description: 'Le salon dans lequel vous souhaitez envoyer les notifications',
                        type: 7,
                        required: true
                    }

                ]
            }
        ],
    }
],
    {
        guildId: process.env.SERVER
    });

let lastFetchFinished = true;


const syncRaffles = async () => {

    let raffle
    var allTweets = await getAllTweets()
    // console.log(allTweets[0])
    for (i in allTweets.data) {
        let raffles = await database.collection('raffles').find().toArray();
        try {
            let link = (allTweets.data[i].text.split('https://')[1].split('\\')[0]).split(/(\s+)/)
            // console.log(link[0])
            raffle = await getPremintPage(link[0])

        try{
        result = (raffles.find(({ title }) => title== raffle.title ))

        }catch(e){}
            if(typeof result == 'undefined') {
              
                await database.collection('raffles').insertOne({ title: raffle.title, url: raffle.url, image: raffle.image, time: raffle.time, status: raffle.status, twitter: raffle.twitter, discord: raffle.discord, balance: raffle.balance })

                if (raffle.status == 'open') {
      
                    console.log('New Raffle found : ' + raffle.title)
                    sendEmbed(raffle)
                }
            }
        } catch (e) {
            console.log(e)
        }

    }

    return true
};


const sendEmbed = async (raffle) => {
    dbChannel = await database.collection('channel').findOne({ id: { $exists: true } })

    const embed = new Discord.MessageEmbed()
        .setTitle(raffle.title)
        .setURL(raffle.url)
        .setImage(raffle.image)
        .addField('End time', (raffle.time != 'off') ? raffle.time : '?', true)
        .addField('Mint Price',(raffle.mint != 'off') ? raffle.mint  : '?', true)
        .addField('Supply', (raffle.supply != 'off') ? raffle.supply  : '?',true)
        .addField('Twitter', raffle.twitter != 'off' ? ':white_check_mark:' : '❌',true)
        .addField('Discord', (raffle.discord != 'off') ? ':white_check_mark:' : '❌',true)
        .addField('ETH', (raffle.balance != 'off') ? raffle.balance  : '❌',true)
    
        .setFooter('Clear Flip', 'https://cdn.discordapp.com/icons/870414973451530261/a_e19c9a848ced830e04ff3737c1ea13d8.webp?size=128')
        
      
    client.channels.cache.get(dbChannel.id)?.send({
        embeds: [embed]
    })
};

const sync = async () => {
    channel = await database.collection('channel').findOne({ id: { $exists: true } })
    try {
        if (channel.id != false) {
            if (!lastFetchFinished) return;
            lastFetchFinished = false;
            console.log(`🤖 Synchronisation à Twitter...\n`);
            

            let zebi = await syncRaffles();
            if (zebi) {
                lastFetchFinished = true;
            }
        }
    } catch (e) { }
};

client.on('ready', async () => {
    const clientMongo = new MongoClient(uri);
    client.application.commands.set([])
    await clientMongo.connect();
    database = clientMongo.db("Premint")

    try {
        await database.createCollection('raffles')
        console.log("raffles")
    } catch (e) { }
    try {
        resultChannel = await database.createCollection('channel')
        if (typeof resultChannel.ok === 'undefined') {
            await database.collection('channel').insertOne({ id: false })
        }
        console.log("channel")
    } catch (e) { }


    console.log("Created database with success")

    client.application.commands.set([])
    console.log(`🔗 Connecté sur le compte de ${client.user.tag} !\n`);

    sync();
    setInterval(sync, 10000);


});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isCommand()) return;
        if (!process.env.ADMIN.includes(interaction.user.id)) return void interaction.reply(`:x: Vous ne disposez pas des droits pour effectuer cette action !`);

        switch (interaction.options.getSubcommand()) {
            case 'channel': {
                await database.collection('channel').updateOne({ id: { $exists: true } }, { $set: { id: interaction.options.getChannel('channel').id } })
                interaction.reply(`:white_check_mark: Le channel a bien été défini !`).catch(err => { });
                break;
            }
        }
    } catch (e) { console.log(e) }
});



const getAllTweets = async () => {
    const resp = await axios({
        method: 'GET',
        url: 'https://api.twitter.com/2/tweets/search/recent?query=premint.xyz%2F%20-is%3Aretweet&max_results=100',
        headers: {
            "authorization": "Bearer " + process.env.BEARER
        }
    })
    return resp.data
}

const getPremintPage = async (link) => {
    let raffle
    
    try {
        const resp = await axios({
            url: 'https://' + link,
            method: 'GET',
            maxRedirects : 1,
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "cache-control": "max-age=0",
                "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"101\", \"Google Chrome\";v=\"101\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
            }
        })
        
        raffle = {
            title: resp.data.split('og:title')[1].split('content="')[1].split('|')[0].trim(),
            url: 'https://www.premint.xyz/' + resp.data.split('og:url')[1].split('content="')[1].split('\/')[3],
            image: resp.data.split('profile-picture profile-picture--style-2 mx-0 mb-2 d-inline-block')[1].split('src="')[1].split('"')[0],


        }
       
        if (resp.data.includes('Raffle Time')) {
            raffle.time = resp.data.split('Raffle Time')[1].split('">')[1].split(/\n/)[1]
        } else {
            raffle.time = 'off'
        }
        if (resp.data.includes('closed')) {
            raffle.status = 'close'
        } else {
            raffle.status = 'open'
        }
        if (resp.data.includes('fa-twitter c-teal-blue')) {
            raffle.twitter = 'required'
        } else {
            raffle.twitter = 'off'
        }
        if (resp.data.includes('fa-discord c-purple')) {
            raffle.discord = 'required'
        } else {
            raffle.discord = 'off'
        }
        if (resp.data.includes('fa-ethereum c-dark')) {
            raffle.balance = resp.data.split('fa-ethereum c-dark')[1].split('strong c-dark">')[1].split('<')[0]
        } else {
            raffle.balance = 'off'
        }
        if(resp.data.includes('fad fa-ticket c-gray-light mr-2')){
            raffle.supply = resp.data.split('fad fa-ticket c-gray-light mr-2')[1].split('</i>')[1].split(/\n/)[1]
        }else{
            raffle.supply = 'off'
        }
        if(resp.data.includes('fa-ethereum c-gray-light mr-2')){
            raffle.mint = resp.data.split('fa-ethereum c-gray-light mr-2')[1].split('</i>')[1].split(/\n/)[1]
        }else{
            raffle.mint = 'off'
        }
      
        return raffle
    } catch (e) {
        //console.log(e)
    }
}


client.login(process.env.TOKEN);
// }

// main()