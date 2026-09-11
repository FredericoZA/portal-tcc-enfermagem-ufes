import { ProcessData } from '../types';

export interface PdfMatchResult {
  file: File;
  matchedProcessId: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  matchReason: string;
}

/**
 * Identifies which TCC process an uploaded PDF belongs to based on filename and content.
 */
export async function identifyProcessFromPdf(
  file: File,
  allProcesses: ProcessData[]
): Promise<PdfMatchResult> {
  const fileName = file.name.toLowerCase();
  const cleanFileName = fileName.replace(/[^a-z0-9]/g, '');

  let bestMatch: ProcessData | null = null;
  let highestScore = 0;
  let matchReason = '';

  for (const proc of allProcesses) {
    let score = 0;
    const reasons: string[] = [];

    const proto = (proc.protocolo || '').toLowerCase();
    const cleanProto = proto.replace(/[^a-z0-9]/g, '');
    const procId = (proc.id || '').toLowerCase();
    const cleanProcId = procId.replace(/[^a-z0-9]/g, '');

    const studentName = (proc.aluno1?.nome || '').toLowerCase();
    const studentParts = studentName.split(' ').filter((p) => p.length > 2);
    const studentMat = (proc.aluno1?.matricula || '').toLowerCase();

    // 1. Exact Protocol match in filename
    if (proto && fileName.includes(proto)) {
      score += 100;
      reasons.push(`Protocolo '${proc.protocolo}' encontrado no nome do arquivo`);
    } else if (cleanProto && cleanProto.length >= 4 && cleanFileName.includes(cleanProto)) {
      score += 90;
      reasons.push(`Protocolo '${proc.protocolo}' identificado`);
    }

    // 2. Process ID match in filename
    if (procId && fileName.includes(procId)) {
      score += 85;
      reasons.push(`ID de processo '${proc.id}' encontrado`);
    } else if (cleanProcId && cleanProcId.length >= 3 && cleanFileName.includes(cleanProcId)) {
      score += 80;
      reasons.push(`ID '${proc.id}' identificado`);
    }

    // 3. Student Matricula match
    if (studentMat && studentMat.length >= 4 && fileName.includes(studentMat)) {
      score += 80;
      reasons.push(`Matrícula '${proc.aluno1?.matricula}' encontrada`);
    }

    // 4. Student Name match
    if (studentName && fileName.includes(studentName.replace(/\s+/g, '_'))) {
      score += 75;
      reasons.push(`Nome do discente '${proc.aluno1?.nome}' encontrado`);
    } else if (studentParts.length >= 2) {
      const firstName = studentParts[0];
      const lastName = studentParts[studentParts.length - 1];
      if (fileName.includes(firstName) && fileName.includes(lastName)) {
        score += 65;
        reasons.push(`Nome '${firstName} ${lastName}' encontrado`);
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = proc;
      matchReason = reasons.join('; ');
    }
  }

  // 5. If score is still low, try reading text from PDF
  if (highestScore < 50 && file.size < 5000000) {
    try {
      const textContent = await readPdfTextPreview(file);
      const lowerText = textContent.toLowerCase();

      for (const proc of allProcesses) {
        const proto = (proc.protocolo || '').toLowerCase();
        const procId = (proc.id || '').toLowerCase();
        const studentName = (proc.aluno1?.nome || '').toLowerCase();

        if (proto && lowerText.includes(proto)) {
          bestMatch = proc;
          highestScore = 95;
          matchReason = `Protocolo '${proc.protocolo}' encontrado no conteúdo do PDF`;
          break;
        } else if (procId && lowerText.includes(procId)) {
          bestMatch = proc;
          highestScore = 90;
          matchReason = `ID de processo '${proc.id}' encontrado no conteúdo do PDF`;
          break;
        } else if (studentName && studentName.length > 5 && lowerText.includes(studentName)) {
          bestMatch = proc;
          highestScore = 75;
          matchReason = `Nome do discente '${proc.aluno1?.nome}' encontrado no conteúdo do PDF`;
          break;
        }
      }
    } catch {
      // ignore text preview failure
    }
  }

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
  if (highestScore >= 80) confidence = 'HIGH';
  else if (highestScore >= 50) confidence = 'MEDIUM';
  else if (highestScore >= 30) confidence = 'LOW';

  return {
    file,
    matchedProcessId: bestMatch ? bestMatch.id : null,
    confidence,
    matchReason: matchReason || 'Não foi possível identificar o processo automaticamente pelo nome.'
  };
}

/**
 * Reads text fragment from PDF file for content matching.
 */
function readPdfTextPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result || '');
    };
    reader.onerror = () => resolve('');
    reader.readAsText(file.slice(0, 50000));
  });
}
