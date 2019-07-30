const {useEffect, useState} = React
const {
  Card,
  CardContent,
  CardActions,
  Button,
} = MaterialUI;

import {getPeers} from './background.js'


function Peer(props) {
  const [p, setP] = useState(null)
  const [connected, setConnected] = useState(false)
  
  function connect() {
    const p = p2pconnect(props.clientid)
    p.on('connected',()=>{
      setConnected(true)
    })
    setP(p)
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

  useEffect(()=>{
    if (p) {
      console.log('p changed...')
    }
  },[p])
  
  return (
    <Card styles={{padding:10,margin:10}}>
      <CardContent>
        Peer: {props.info.name}
        <br />
        {p ? JSON.stringify(p) : null }
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
  const approot = document.getElementById('approot')
  console.log('approot',approot)
  ReactDOM.render(

      <Options />
      ,approot

  );
});
