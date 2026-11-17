"""Run with python3 scripts/test-reconcile-legacy-publication.py; no network or writes."""
import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('reconcile_legacy_publication', Path(__file__).with_name('reconcile-legacy-publication.py'))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

HOST = 'https://enfermagem.vitoria.ufes.br/sites/enfermagem.vitoria.ufes.br/files/field/anexo/'
SHA = 'a' * 64


def fixture():
    row = {'legacyId': 'legado-0037', 'sourceFingerprint': 'row-mariana', 'sourceLinks': [HOST + 'resumo_tcc_mpt.pdf']}
    record = {
        'id': 'legado-0029', 'titulo': 'Práticas de Enfermagem', 'isPublic': True,
        'publishFullWork': False, 'publishExpandedAbstract': True,
        'attachments': [{'kind': 'RESUMO_EXPANDIDO', 'sha256': SHA, 'sourceFileName': 'resumo_tcc_mpt.pdf'}],
        'provenance': {'originalConsent': ['Sim'], 'pageRecords': [copy.deepcopy(row)],
                       'publicationImportBaseline': {'publicFiles': [{
                           'kind': 'RESUMO_EXPANDIDO', 'sha256': SHA,
                           'sourceUrl': HOST + 'resumo_tcc_mpt.pdf', 'sourceRowFingerprint': 'row-mariana',
                           'sourceRecordId': 'legado-0029', 'sourcePageRecordId': row['legacyId']}]}}
    }
    return record, [row]


def issues(current, page, baseline=None, sheet_consent=None):
    result = policy.reconcile([copy.deepcopy(baseline or current)], [current],
                              {row['sourceFingerprint'] for row in page if row['sourceLinks']},
                              sheet_consent, page)
    return result['records'][0]['issues']


class BodyLinkPublicationTests(unittest.TestCase):
    def test_accepts_the_verified_kind_hash_and_exact_own_body_link(self):
        current, page = fixture()
        self.assertEqual(issues(current, page), [])

    def test_rejects_the_real_29_30_crossed_links_even_with_positive_consent(self):
        current, page = fixture()
        page[0]['sourceLinks'] = [HOST + 'tcc_feridas_oncologicas_-_resumo_0.pdf']
        current['provenance']['pageRecords'] = copy.deepcopy(page)
        page.append({'legacyId': 'legado-0030', 'sourceFingerprint': 'row-ayme', 'sourceLinks': [HOST + 'resumo_tcc_mpt.pdf']})
        current['provenance']['recoveredSourceFile'] = {
            'url': HOST + 'resumo_tcc_mpt.pdf', 'sourcePageRecordId': 'legado-0030',
            'verifiedRecordId': 'legado-0029', 'method': 'ABSTRACT_CONTENT_MATCH'}
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_cannot_borrow_another_works_row_fingerprint(self):
        current, page = fixture()
        page.append({'legacyId': 'legado-0030', 'sourceFingerprint': 'row-ayme', 'sourceLinks': [HOST + 'resumo_tcc_mpt.pdf']})
        current['provenance']['publicationImportBaseline']['publicFiles'][0]['sourceRowFingerprint'] = 'row-ayme'
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_cannot_replace_own_source_row_to_borrow_another_works_link(self):
        current, page = fixture()
        baseline = copy.deepcopy(current)
        other = {'legacyId': 'legado-0030', 'sourceFingerprint': 'row-ayme', 'sourceLinks': [HOST + 'resumo_tcc_mpt.pdf']}
        page.append(other)
        current['provenance']['pageRecords'] = [copy.deepcopy(other)]
        proof = current['provenance']['publicationImportBaseline']['publicFiles'][0]
        proof.update(sourceRowFingerprint=other['sourceFingerprint'], sourcePageRecordId=other['legacyId'])
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page, baseline))

    def test_source_page_ordinal_is_independent_of_the_catalog_id(self):
        current, page = fixture()
        self.assertNotEqual(page[0]['legacyId'], current['id'])
        self.assertEqual(issues(current, page), [])
        current['provenance']['publicationImportBaseline']['publicFiles'][0]['sourcePageRecordId'] = current['id']
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_cannot_attach_a_correct_hash_to_a_different_body_filename(self):
        current, page = fixture()
        wrong = HOST + 'tcc_feridas_oncologicas_-_resumo_0.pdf'
        page[0]['sourceLinks'] = [wrong]
        current['provenance']['publicationImportBaseline']['publicFiles'][0]['sourceUrl'] = wrong
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_a_cms_attachment_is_not_a_body_link(self):
        current, page = fixture()
        page[0]['sourceLinks'] = []
        current['provenance']['cmsAttachments'] = [HOST + 'resumo_tcc_mpt.pdf']
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_missing_explicit_source_evidence_stays_private(self):
        current, page = fixture()
        del current['provenance']['publicationImportBaseline']['publicFiles'][0]['sourceUrl']
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))

    def test_body_links_do_not_override_negative_consent(self):
        current, page = fixture()
        current['provenance']['originalConsent'] = ['Sim', 'Não']
        self.assertIn('NEGATIVE_CONSENT', issues(current, page))

    def test_original_spreadsheet_veto_is_preserved(self):
        current, page = fixture()
        veto = {policy.norm(current['titulo']): ['Não autorizo']}
        self.assertIn('NEGATIVE_CONSENT', issues(current, page, sheet_consent=veto))

    def test_body_links_do_not_reactivate_a_withdrawal(self):
        current, page = fixture()
        current['provenance']['publicationWithdrawal'] = {'withdrawnAt': '2026-11-16T12:00:00Z'}
        self.assertIn('PUBLICATION_WITHDRAWN', issues(current, page))

    def test_cannot_erase_the_original_withdrawal_in_the_candidate(self):
        for withdrawal in [{'withdrawn': True}, {'publicationWithdrawal': {'withdrawnAt': '2026-11-16T12:00:00Z', 'drivePending': False}}]:
            current, page = fixture()
            baseline = copy.deepcopy(current)
            baseline['provenance'].update(withdrawal)
            self.assertIn('PUBLICATION_WITHDRAWN', issues(current, page, baseline))

    def test_replacing_content_is_not_authorized_by_the_same_url(self):
        current, page = fixture()
        baseline = copy.deepcopy(current)
        current['attachments'][0]['sha256'] = 'b' * 64
        current['provenance']['publicationImportBaseline']['publicFiles'][0]['sha256'] = 'b' * 64
        self.assertIn('NEW_PUBLIC_KIND_OR_CONTENT', issues(current, page, baseline))

    def test_preserves_an_identical_submission_original_with_another_filename(self):
        current, page = fixture()
        baseline = copy.deepcopy(current)
        current['attachments'][0]['sourceFileName'] = 'original-da-submissao.pdf'
        self.assertEqual(issues(current, page, baseline), [])

    def test_public_abstract_does_not_make_the_full_work_public(self):
        current, page = fixture()
        current['attachments'].append({'kind': 'TRABALHO_COMPLETO', 'sha256': 'b' * 64, 'sourceFileName': 'full-work.pdf'})
        baseline = copy.deepcopy(current)
        self.assertEqual(issues(current, page, baseline), [])
        current['publishFullWork'] = True
        self.assertIn('NEW_PUBLIC_KIND_OR_CONTENT', issues(current, page, baseline))
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page, baseline))

    def test_url_fragment_does_not_identify_a_different_pdf(self):
        current, page = fixture()
        page[0]['sourceLinks'][0] += '#overlay-context=pt-br/trabalhos-de-conclusao-de-curso-defendidos'
        self.assertEqual(issues(current, page), [])

    def test_missing_authoritative_page_rows_fails_closed(self):
        current, _ = fixture()
        result = policy.reconcile([current], [current])
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', result['records'][0]['issues'])

    def test_ambiguous_source_rows_fail_closed(self):
        current, page = fixture()
        page.append(copy.deepcopy(page[0]))
        self.assertIn('PUBLIC_FILE_BODY_LINK_NOT_CONFIRMED', issues(current, page))


if __name__ == '__main__':
    unittest.main()
