const labels=[], splcData=[], btcData=[], ethData=[];
function createChart(id,label,color,data){
  return new Chart(document.getElementById(id),{
    type:'line',
    data:{ labels, datasets:[{ label, borderColor:color, data, fill:false }]},
    options:{ animation:false }
  });
}
const splcChart=createChart('splcChart','SPRC Price','blue',splcData);
const btcChart=createChart('btcChart','Bitcoin Price','orange',btcData);
const ethChart=createChart('ethChart','Ethereum Price','green',ethData);

const sse=new EventSource('/sse/splc');
sse.onmessage=e=>{
  const d=JSON.parse(e.data);
  const t=new Date(d.ts).toLocaleTimeString();
  labels.push(t);
  splcData.push(d.price);
  btcData.push(d.bitcoin);
  ethData.push(d.ethereum);
  if(labels.length>50){labels.shift();splcData.shift();btcData.shift();ethData.shift();}
  splcChart.update(); btcChart.update(); ethChart.update();
};
