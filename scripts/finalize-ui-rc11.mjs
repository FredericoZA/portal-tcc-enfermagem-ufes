import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,value){fs.writeFileSync(path,value);}
function replaceOnce(text,search,replacement,label){
  if(!text.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  return text.replace(search,replacement);
}

// 1) Rodapé: QR 20% menor.
{
  const path='src/components/Footer.tsx';
  let s=read(path);
  s=replaceOnce(s,'w-[108px] h-[108px] sm:w-[130px] sm:h-[130px]','w-[86px] h-[86px] sm:w-[104px] sm:h-[104px]','QR code 20% menor');
  write(path,s);
}

// 2) Calendário/lista pública: barras mais compactas, filtros consistentes e sem visão fixa de julho.
{
  const path='src/pages/HomePage.tsx';
  let s=read(path);
  s=replaceOnce(s,'className={`${defStyles.calendarBannerClass} p-3.5 sm:p-4 border-b transition-colors`}','className={`${defStyles.calendarBannerClass} px-3 sm:px-4 py-2 sm:py-2.5 border-b transition-colors`}','barra do calendário compacta');
  s=replaceOnce(s,'className={`${defStyles.bannerHeaderClass} p-3.5 sm:p-4 space-y-3 border-b transition-colors`}','className={`${defStyles.bannerHeaderClass} px-3 sm:px-4 py-2 sm:py-2.5 space-y-2 border-b transition-colors`}','barra da lista compacta');
  s=replaceOnce(s,'className="pt-2 border-t flex flex-wrap items-center gap-2 text-xs min-w-0 w-full"','className="pt-1.5 border-t flex flex-wrap items-center gap-2 text-xs min-w-0 w-full"','filtros compactos');
  s=replaceOnce(s,
`                          style={chip.buttonStyle}\n                          className={\`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all border select-none ${'${'}\n                            isSelected ? 'shadow-xs scale-[1.02]' : 'opacity-85 hover:opacity-100'\n                          }\`}`,
`                          data-selected={isSelected ? 'true' : 'false'}\n                          style={chip.buttonStyle}\n                          className={\`portal-table-filter-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all border select-none ${'${'}\n                            isSelected ? 'shadow-xs scale-[1.02]' : 'opacity-85 hover:opacity-100'\n                          }\`}`,
'classe dos filtros de situação');

  const restoreBlock=`                  <div className="pt-2 flex items-center justify-center gap-2">\n                    <button\n                      type="button"\n                      onClick={() => {\n                        setDefensesSearch('');\n                        setDefensesStartDate('');\n                        setDefensesEndDate('');\n                        setDefenseStatusFilter('all');\n                        setSelectedFilterMonth(6);\n                        setSelectedFilterYear(2026);\n                        setCurrentCalendarDate(new Date(2026, 6, 1));\n                      }}\n                      className="px-3.5 py-1.5 bg-emerald-950 hover:bg-black text-white font-extrabold text-xs uppercase rounded-full border border-emerald-500 cursor-pointer transition-colors shadow-2xs inline-block"\n                    >\n                      Restaurar Visão Padrão (Julho de 2026)\n                    </button>\n                  </div>\n`;
  s=replaceOnce(s,restoreBlock,'','remoção da visão fixa de julho de 2026');
  write(path,s);
}

// 3) Padrão visual dos controles acima das planilhas: branco/cinza; selecionado escuro.
{
  const path='src/portal-overrides.css';
  let s=read(path);
  const marker='/* Padrão rc.11: controles de planilha neutros; verde reservado aos cabeçalhos. */';
  if(!s.includes(marker)){
    s += `\n\n${marker}\nbutton[title="Selecionar Mês e Ano"],\nbutton[title="Mês Anterior"],\nbutton[title="Ir para o mês atual"],\nbutton[title="Próximo Mês"],\nbutton[title^="Buscar"],\nbutton[title="Atualizar dados da tabela"],\nbutton[title="Exibição da planilha: linhas e período"],\nbutton[title^="Exportar todo o banco de dados"] {\n  background: #f8fafc !important;\n  color: #334155 !important;\n  border-color: #cbd5e1 !important;\n}\n\nbutton[title="Selecionar Mês e Ano"]:hover,\nbutton[title="Mês Anterior"]:hover,\nbutton[title="Ir para o mês atual"]:hover,\nbutton[title="Próximo Mês"]:hover,\nbutton[title^="Buscar"]:hover,\nbutton[title="Atualizar dados da tabela"]:hover,\nbutton[title="Exibição da planilha: linhas e período"]:hover,\nbutton[title^="Exportar todo o banco de dados"]:hover {\n  background: #e2e8f0 !important;\n  color: #1e293b !important;\n}\n\n.portal-table-filter-chip {\n  background: #f8fafc !important;\n  color: #334155 !important;\n  border-color: #cbd5e1 !important;\n}\n.portal-table-filter-chip[data-selected="true"] {\n  background: #03271f !important;\n  color: #ffffff !important;\n  border-color: #365349 !important;\n}\n`;
  }
  write(path,s);
}

// 4) Versão visível do sistema: rc.11.
for(const path of ['package.json','package-lock.json','src/components/Sidebar.tsx']){
  let s=read(path);
  s=s.replaceAll('1.0.0-rc.10','1.0.0-rc.11');
  write(path,s);
}

console.log('Ajustes rc.11 aplicados.');
