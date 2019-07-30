const {useEffect, useState} = React
const {
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
} = MaterialUI;

import {
  main,
  getPeers,
  p2pconnect,
} from './common.js'



window.initiator_conns = {}
window.client_conns = {}


function Peer(props) {
  const [p, setP] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  
  async function connect() {
    const p = p2pconnect(props.clientid)
    setP(p)
    setConnecting(true)
    p.on('connected',()=>{
      setConnected(true)
      setConnecting(false)
    })
  }
  function screenshot() {
    p.send({command:{screenshot:true}})
  }
  function screenshot_png() {
    p.send({command:{responseType:'arrayBuffer',fetch:'/screenshot.png'}})
  }
  function reload() {
    p.send({command:{reload:true}})
  }
  function echo() {
    p.send({command:{echo:'echo this'}})
  }
  
  return (
    <Card styles={{padding:10,margin:10}}>
      <CardContent>
        Peer: {props.info.name}
        <br />
        {p ? JSON.stringify(p) : null }
        {connecting ? <CircularProgress /> : null}
      </CardContent>
      <CardActions>
        <Button onClick={connect}>Connect</Button>
        {connected &&
         <span>
         <Button onClick={screenshot}>Screenshot</Button>
         <Button onClick={screenshot_png}>Screenshot.png</Button>
         <Button onClick={echo}>Echo</Button>
         <Button onClick={reload}>Reload</Button>
        </span>
        }
      </CardActions>
    </Card>
  );
}

function Options() {
  const [peers, setPeers] = useState(null);
  useEffect(()=>{
    (async()=>{
      const res = await getPeers()
      setPeers(res)
    })()
  },[])

  return (
    <div>
    Peers ({peers && peers.length})

    <ul>
    {peers && peers.map(peer => {
      return <li key={peer.clientid}><Peer {...peer} /></li>
    })}
    </ul>
    </div>
  )
}

document.addEventListener("DOMContentLoaded",()=>{

  main()
  
  const approot = document.getElementById('approot')
  console.log('approot',approot)
  ReactDOM.render(

      <Options />
      ,approot

  );
});
