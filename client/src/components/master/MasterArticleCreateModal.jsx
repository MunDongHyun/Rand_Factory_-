import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../lib/api';

const INITIAL = {
  article_source: 'DBR',
  article_title: '',
  article_author: '',
  article_published_date: '',
  article_category: '',
  article_source_url: '',
  content: '',
};

const ARTICLE_PDF_MAX_BYTES = 30 * 1024 * 1024;

function MasterArticleCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    api.get('/articles/categories')
      .then((res) => setCategoryOptions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategoryOptions([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL);
      setPdfFile(null);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const handlePdfSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPdfFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.warn('PDF 파일만 업로드할 수 있습니다.');
      setPdfFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > ARTICLE_PDF_MAX_BYTES) {
      toast.warn('PDF는 30MB 이하만 업로드할 수 있습니다.');
      setPdfFile(null);
      e.target.value = '';
      return;
    }
    setPdfFile(file);
  };

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const isValid =
    form.article_source &&
    form.article_title.trim() &&
    form.article_author.trim() &&
    form.article_published_date &&
    form.article_category.trim() &&
    form.article_source_url.trim();

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/articles', {
        article_source: form.article_source,
        article_title: form.article_title.trim(),
        article_author: form.article_author.trim(),
        article_published_date: form.article_published_date,
        article_category: form.article_category.trim(),
        article_source_url: form.article_source_url.trim(),
        content: form.content.trim() || null,
      });
      let created = res.data;
      // 원본 PDF 첨부가 있으면 별도 호출 (실패해도 아티클 등록 자체는 성공으로 처리)
      if (pdfFile && created?.article_id) {
        try {
          const fd = new FormData();
          fd.append('file', pdfFile, pdfFile.name);
          const pdfRes = await api.post(`/articles/${created.article_id}/pdf`, fd);
          created = pdfRes.data;
        } catch (pdfErr) {
          toast.warn('아티클은 등록됐지만 원본 PDF 업로드는 실패했습니다.');
        }
      }
      toast.success('아티클이 등록되었습니다.');
      if (onCreated) onCreated(created);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0]?.msg || '등록에 실패했습니다.') : (detail || '등록에 실패했습니다.');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="masterPanelOverlay" onClick={saving ? undefined : onClose} />
      <aside className="masterArticlePanel">
        <div className="masterPanelHeader">
          <h2 className="sectionTitle">아티클 등록</h2>
          <button className="masterdrawerLogout" onClick={onClose} disabled={saving}>
            닫기
          </button>
        </div>

        <div className="masterArticleForm">
          <div className="masterArticleField">
            <label>출처</label>
            <div className="masterArticleSourceRow">
              {['DBR', 'HBR'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`masterArticleSourceBtn ${form.article_source === s ? 'active' : ''}`}
                  onClick={() => set('article_source', s)}
                  disabled={saving}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="masterArticleField">
            <label>제목 *</label>
            <input
              type="text"
              value={form.article_title}
              onChange={(e) => set('article_title', e.target.value)}
              placeholder="아티클 제목"
              disabled={saving}
            />
          </div>

          <div className="masterArticleField">
            <label>저자 *</label>
            <input
              type="text"
              value={form.article_author}
              onChange={(e) => set('article_author', e.target.value)}
              placeholder="이름 또는 콤마로 구분된 이름들"
              disabled={saving}
            />
          </div>

          <div className="masterArticleFieldRow">
            <div className="masterArticleField">
              <label>발행일 *</label>
              <input
                type="date"
                value={form.article_published_date}
                onChange={(e) => set('article_published_date', e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="masterArticleField">
              <label>카테고리 *</label>
              <input
                type="text"
                value={form.article_category}
                onChange={(e) => set('article_category', e.target.value)}
                placeholder="예: 마케팅, 경영전략 ..."
                list="masterArticleCategoryOptions"
                disabled={saving}
              />
              <datalist id="masterArticleCategoryOptions">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="masterArticleField">
            <label>원문 URL *</label>
            <input
              type="url"
              value={form.article_source_url}
              onChange={(e) => set('article_source_url', e.target.value)}
              placeholder="https://..."
              disabled={saving}
            />
          </div>

          <div className="masterArticleField">
            <label>본문 (선택)</label>
            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="본문 텍스트를 입력하면 검색(RAG)에 자동 인제스트됩니다."
              rows={10}
              disabled={saving}
            />
          </div>

          <div className="masterArticleField">
            <label>원본 PDF (선택, 최대 30MB)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfSelect}
              disabled={saving}
            />
            {pdfFile && (
              <p className="masterArticleHint">선택됨: {pdfFile.name} ({Math.round(pdfFile.size / 1024)} KB)</p>
            )}
          </div>

          {error && <p className="masterArticleError">{error}</p>}

          <div className="masterArticleActions">
            <button className="masterArticleCancelBtn" type="button" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button
              className="masterArticleSubmitBtn"
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || saving}
            >
              {saving ? '등록 중...' : '아티클 등록'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default MasterArticleCreateModal;
