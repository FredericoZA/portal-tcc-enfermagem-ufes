from pathlib import Path

p=Path('src/pages/MeusProcessosPage.tsx')
s=p.read_text()
old='''      case 'progresso':
        return (
          <td key="progresso" className={`${styles.cellPadClass} ${widthClass} text-center align-middle ${styles.borderClass}`}>
            <ProgressIndicator percent={progress.percent} label={progress.label} textFormat={meusProcessosTextFormat} />
          </td>
        );'''
if old not in s:
    raise SystemExit('Trecho de progresso de Meus TCCs não encontrado')
new='''      case 'progresso': {
        const stageNumber = getStepNumberLabel(progress.label).replace('Fase ', '') || '—';
        return (
          <td key="progresso" className={`${styles.cellPadClass} ${widthClass} text-center align-middle ${styles.borderClass}`}>
            <span className="portal-stage-number inline-flex min-w-[24px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600" title={progress.label} aria-label={progress.label}>
              {stageNumber}
            </span>
          </td>
        );
      }'''
p.write_text(s.replace(old,new))

t=Path('server/update44FinalPolishContract.test.ts')
q=t.read_text()
old_test="""  const indicator=read('src/components/ProgressIndicator.tsx');
  assert.match(p,/key: 'progresso', label: 'Etapa'/);
  assert.match(indicator,/portal-stage-number/);
  assert.doesNotMatch(indicator,/>\\s*\\{value\\}%\\s*</);"""
new_test="""  assert.match(p,/key: 'progresso', label: 'Etapa'/);
  assert.match(p,/portal-stage-number/);
  assert.match(p,/stageNumber = getStepNumberLabel/);"""
if old_test not in q:
    raise SystemExit('Contrato de etapa não encontrado')
t.write_text(q.replace(old_test,new_test))

Path('scripts/scope-stage44.py').unlink()
Path('.github/workflows/scope-stage44.yml').unlink()
print('Escopo da coluna Etapa ajustado.')
