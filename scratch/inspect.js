const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('video_ltx2_3_t2v.json', 'utf8'));

function inspectNode(nodes, targetId, namePrefix = '') {
  nodes.forEach(n => {
    if (n.id === targetId) {
      console.log(`=== Node ${namePrefix}${targetId} (${n.type}) ===`);
      console.log(JSON.stringify(n, null, 2));
    }
  });
}

// Node 75 is in the main graph
inspectNode(wf.nodes, 75);

// The other nodes are in the subgraph 267
const subgraph = wf.definitions.subgraphs[0];
[221, 238, 248, 327].forEach(id => {
  inspectNode(subgraph.nodes, id, '267_');
});
