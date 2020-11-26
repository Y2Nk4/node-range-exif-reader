let net = require('net'),
    url = require('url'),
    http = require('http')

let server = http.createServer()

let allReqTotal = 0

function connect(clientRequest, clientSocket, head) {
    // 连接目标服务器
    console.log('connect')
    let url = clientRequest.url.split(':')
    console.log(url)
    const targetSocket = net.connect(url[1], url[0], async () => {
        // 通知客户端已经建立连接
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n'
            + 'Proxy-agent: MITM-proxy\r\n'
            + '\r\n',
        );

        console.log('built')

        // 建立通信隧道，转发数据
        targetSocket.write(head);

        let totalByte = 0

        clientSocket.on('end', () => {
            console.log('socket end')
            console.log('Fetch Size:', formatBytes(totalByte))
        })
        targetSocket.on('data', (data) => {
            totalByte += data.length
            allReqTotal += data.length
        })
        clientSocket.on('close', () => { console.log('close') })

        targetSocket.on('close', () => {
            console.log('targetSocket close')
            console.log('Fetch Size:', formatBytes(totalByte), '| Total:', formatBytes(allReqTotal))
        })

        clientSocket.on('error', (err) => {
            console.log('clientSocket error:', err)
            console.log('Fetch Size:', formatBytes(totalByte))
            targetSocket.end()
        })
        targetSocket.on('error', (err) => {
            console.log('targetSocket error:', err)
            console.log('Fetch Size:', formatBytes(totalByte))
            clientSocket.end()
        })

        clientSocket.pipe(targetSocket).pipe(clientSocket);
    });
}

server
    .on('connection', (clientRequest, clientSocket, head) => {
        console.log('connection')
    })
    .on('request', (req, res) => {
        console.log('request')
    })
    .on('connect', connect)
    .on('error', err => {
        console.log(err)
    })

server.listen(10087, () => {
    console.log('listening 10087')
})

function formatBytes(a,b=2){if(0===a)return"0 Bytes";const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"][d]}
