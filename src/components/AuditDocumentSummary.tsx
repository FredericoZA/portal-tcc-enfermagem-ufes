import React from 'react';
import type {AuditLog} from '../types';
import {auditDocumentEvent} from '../utils/auditDocumentPresentation';
import {formatAuditTimestamp} from '../utils/formatters';
export function AuditDocumentSummary({log,details=false}:{log:AuditLog;details?:boolean}){
 const event=auditDocumentEvent(log);if(!event)return null;
 if(!details)return <span className="mt-1 block space-y-0.5 text-[10px] font-normal leading-4 text-slate-700"><strong className="block text-slate-900">{event.title}{event.version?` · versão ${event.version}`:''}{event.provider?` · ${event.provider}`:''}</strong>{event.result&&<span className="block">{event.result}{event.count!==undefined?` · ${event.count}/${event.total} assinaturas confirmadas`:event.total!==undefined?` · ${event.total} assinaturas exigidas`:''}</span>}{event.verified.length>0&&<span className="block">Assinaram: {event.verified.map(person=>person.name).join('; ')}</span>}{event.outstanding.length > 0 && <span className="block">Sem assinatura neste evento: {event.outstanding.map(person => person.name).join(', ')}</span>}{event.expected.length > 0 && <span className="block">Signatários previstos: {event.expected.map(person => person.name).join(', ')}</span>}{event.stage&&<span className="block">Etapa do evento: {event.stage}</span>}</span>;
 return <section aria-label="Documento e assinaturas deste evento" className="mt-3 rounded-lg border border-slate-300 bg-white p-3"><h3 className="mb-3 text-sm font-bold">Documento e assinaturas</h3><dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="font-semibold text-slate-600">Documento</dt><dd>{event.title}{event.version?` · versão ${event.version}`:''}</dd></div><div><dt className="font-semibold text-slate-600">Etapa do evento</dt><dd>{event.stage||'Não registrada neste evento'}</dd></div>{event.provider&&<div><dt className="font-semibold text-slate-600">Plataforma</dt><dd>{event.provider}</dd></div>}<div><dt className="font-semibold text-slate-600">Situação registrada</dt><dd>{event.result||'Não registrada'}{event.previousStatus&&<span className="block text-slate-600">Antes: {event.previousStatus}</span>}</dd></div>{event.total!==undefined&&<div><dt className="font-semibold text-slate-600">Assinaturas</dt><dd>{event.count===undefined?`${event.total} exigidas; quantidade assinada não registrada`:`${event.count} de ${event.total} confirmadas`}</dd></div>}</dl>{event.evidence&&<p className="mt-3 text-xs text-slate-600">Confirmação: {event.evidence==='ASTEN_SIGNERS_READBACK'?'consulta dos signatários na ASTEN':event.evidence==='GOV_BR_MANUAL_REVIEW'?'conferência manual do PDF assinado pelo Gov.br':'origem registrada no histórico'}.</p>}{event.verified.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-center text-xs"><thead><tr className="border-b border-slate-300"><th className="py-2 pr-3">Quem assinou</th><th className="py-2 pr-3">Participação</th><th className="py-2">Data da assinatura</th></tr></thead><tbody>{event.verified.map((person,index)=><tr key={index} className="border-b border-slate-200"><td className="py-2 pr-3 font-semibold">{person.name}{person.email&&person.email!==person.name&&<span className="block break-all font-normal text-slate-600">{person.email}</span>}</td><td className="py-2 pr-3">{person.role||'Não registrada'}</td><td className="py-2">{person.signedAt&&Number.isFinite(Date.parse(person.signedAt))?formatAuditTimestamp(person.signedAt):'Não registrada pelo provedor'}</td></tr>)}</tbody></table></div>:<p className="mt-3 text-xs text-slate-600">Este evento não registra confirmação individual de signatários.</p>}
 {event.expected.length > 0 && <div className="mt-3">
   <h4 className="text-xs font-bold">Signatários previstos na geração do documento</h4>
   <ul className="mt-1 space-y-1 text-xs">{event.expected.map((person, index) =>
     <li key={index}>{[person.name, person.role].filter(Boolean).join(' · ')}</li>
   )}</ul>
 </div>}
 {event.outstanding.length > 0 && <div className="mt-3">
   <h4 className="text-xs font-bold">Signatários sem assinatura confirmada neste evento</h4>
   <ul className="mt-1 space-y-1 text-xs">{event.outstanding.map((person, index) =>
     <li key={index}>{[person.name, person.role, person.status].filter(Boolean).join(' · ')}</li>
   )}</ul>
 </div>}
 </section>;
}
