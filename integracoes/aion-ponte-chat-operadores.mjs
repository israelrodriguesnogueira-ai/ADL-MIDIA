import {identificarOperador} from './ion-roteador-operadores.mjs';
import {executarOperadorLocal} from './aion-operadores-locais.mjs';
// Ponte local do chat: nao acessa redes, credenciais ou contas externas.
export function executarComandoChat(comando,dados={}){
 if(typeof comando!=='string'||!comando.trim()||comando.length>3000)return {status:'erro',erro:'Comando invalido'};
 const {operador}=identificarOperador(comando);
 if(!['midia','financeiro','cientifico','shopee'].includes(operador))return {status:'nao_suportado',operador,detalhe:'Sem executor para esta intencao'};
 const resultado=executarOperadorLocal({operador,comando,dados});
 return {...resultado,origem:'chat',publicado:false,executadoExternamente:false};
}
