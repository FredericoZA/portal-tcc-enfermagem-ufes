import fs from 'node:fs';

const path = 'src/pages/HomePage.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('{dayDefenses.map((proc) => {') && source.includes('{dayGcal.map((ev) => {')) {
  console.log('Resumos completos já aplicados.');
  process.exit(0);
}

const oldBlock = `{dayDefenses.slice(0, 2).map((proc) => {
                          const defenseState = getDefenseState(proc);
                          return (
                            <span
                              key={proc.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={formatDefenseCalendarSummary(proc, 160)}
                            >
                              {formatDefenseCalendarSummary(proc)}
                            </span>
                          );
                        })}
                        {dayDefenses.length < 2 && dayGcal.slice(0, 2 - dayDefenses.length).map((ev) => {
                          const defenseState = getDefenseStateFromTimes(ev.start, ev.end);
                          const parsed = parseGcalEvent(ev);
                          const startLabel = ev.start
                            ? new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : 'Horário a definir';
                          const summary = startLabel + ' · ' + parsed.trabalho;
                          return (
                            <span
                              key={ev.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={summary}
                            >
                              {summary}
                            </span>
                          );
                        })}
                        {totalEvents > 2 && (
                          <span className="block text-[9px] font-bold text-slate-600 px-1">
                            +{totalEvents - 2} {totalEvents - 2 === 1 ? 'defesa' : 'defesas'}
                          </span>
                        )}`;

const newBlock = `{dayDefenses.map((proc) => {
                          const defenseState = getDefenseState(proc);
                          return (
                            <span
                              key={proc.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={formatDefenseCalendarSummary(proc, 160)}
                            >
                              {formatDefenseCalendarSummary(proc)}
                            </span>
                          );
                        })}
                        {dayGcal.map((ev) => {
                          const defenseState = getDefenseStateFromTimes(ev.start, ev.end);
                          const parsed = parseGcalEvent(ev);
                          const startLabel = ev.start
                            ? new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : 'Horário a definir';
                          const summary = startLabel + ' · ' + parsed.trabalho;
                          return (
                            <span
                              key={ev.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={summary}
                            >
                              {summary}
                            </span>
                          );
                        })}`;

if (!source.includes(oldBlock)) {
  throw new Error('Bloco de resumos limitados não localizado; revisão manual necessária.');
}

source = source.replace(oldBlock, newBlock);
source = source.replace('className="mt-1 flex-1 min-h-0 space-y-1 overflow-hidden w-full"', 'className="mt-1 flex-1 min-h-0 space-y-1 w-full"');
fs.writeFileSync(path, source);
console.log('Todos os trabalhos do dia passam a aparecer no calendário.');
