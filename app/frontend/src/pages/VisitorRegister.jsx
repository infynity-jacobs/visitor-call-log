import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const EMPTY_FORM = {
  name: '', place: '', phone: '', purpose: '',
  purposeDetails: '', enquiryType: '', enquiryDetails: '',
  complaintDetails: '', purchaseDetails: '', personToVisit: '',
  personToVisitOther: '', interviewDetails: '', donationDetails: '', otherDetails: ''
};

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function VisitorRegister() {
  const [options, setOptions] = useState({ purposeOptions: [], enquiryTypeOptions: [], meetingPersonOptions: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState([]);

  const loadOptions = useCallback(async () => {
    const data = await api.request('/visitors/options/all');
    setOptions(data);
  }, []);

  const loadRecent = useCallback(async () => {
    const data = await api.request('/visitors?mode=all&limit=8');
    setRecent(data.records);
  }, []);

  useEffect(() => {
    loadOptions().catch((err) => setMessage({ type: 'error', text: err.message }));
    loadRecent().catch(() => {});
  }, [loadOptions, loadRecent]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setIdempotencyKey(newIdempotencyKey());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // guards against double-click / accidental duplicate submission
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await api.request('/visitors', {
        method: 'POST',
        body: { ...form, idempotencyKey }
      });
      setMessage({
        type: 'success',
        text: data.duplicate
          ? 'This entry was already saved — showing the existing record.'
          : 'Visitor entry saved successfully.'
      });
      resetForm();
      loadRecent().catch(() => {});
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const purpose = form.purpose;

  return (
    <div>
      <h2>Visitor Register</h2>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="name">Name *</label>
              <input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </div>
            <div>
              <label htmlFor="place">Place</label>
              <input id="place" value={form.place} onChange={(e) => update('place', e.target.value)} />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div>
              <label htmlFor="purpose">Purpose *</label>
              <select id="purpose" value={purpose} onChange={(e) => update('purpose', e.target.value)} required>
                <option value="">Select purpose…</option>
                {options.purposeOptions.map((o) => (
                  <option key={o.id} value={o.label}>{o.label}</option>
                ))}
              </select>
            </div>

            {purpose === 'Bill Pay' && (
              <div>
                <label htmlFor="purposeDetails">Bill Pay Details *</label>
                <input id="purposeDetails" value={form.purposeDetails} onChange={(e) => update('purposeDetails', e.target.value)} required />
              </div>
            )}

            {purpose === 'Enquiry' && (
              <>
                <div>
                  <label htmlFor="enquiryType">Enquiry Type *</label>
                  <select id="enquiryType" value={form.enquiryType} onChange={(e) => update('enquiryType', e.target.value)} required>
                    <option value="">Select…</option>
                    {options.enquiryTypeOptions.map((o) => (
                      <option key={o.id} value={o.label}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="enquiryDetails">Enquiry Details *</label>
                  <input id="enquiryDetails" value={form.enquiryDetails} onChange={(e) => update('enquiryDetails', e.target.value)} required />
                </div>
              </>
            )}

            {purpose === 'Complaint' && (
              <div>
                <label htmlFor="complaintDetails">Complaint Details *</label>
                <input id="complaintDetails" value={form.complaintDetails} onChange={(e) => update('complaintDetails', e.target.value)} required />
              </div>
            )}

            {purpose === 'Purchase' && (
              <div>
                <label htmlFor="purchaseDetails">Purchase Details *</label>
                <input id="purchaseDetails" value={form.purchaseDetails} onChange={(e) => update('purchaseDetails', e.target.value)} required />
              </div>
            )}

            {purpose === 'Meeting' && (
              <>
                <div>
                  <label htmlFor="personToVisit">Person to Visit *</label>
                  <select id="personToVisit" value={form.personToVisit} onChange={(e) => update('personToVisit', e.target.value)} required>
                    <option value="">Select…</option>
                    {options.meetingPersonOptions.map((o) => (
                      <option key={o.id} value={o.label}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {form.personToVisit === 'Others' && (
                  <div>
                    <label htmlFor="personToVisitOther">Others Details *</label>
                    <input id="personToVisitOther" value={form.personToVisitOther} onChange={(e) => update('personToVisitOther', e.target.value)} required />
                  </div>
                )}
              </>
            )}

            {purpose === 'Interview' && (
              <div>
                <label htmlFor="interviewDetails">Interview Details *</label>
                <input id="interviewDetails" value={form.interviewDetails} onChange={(e) => update('interviewDetails', e.target.value)} required />
              </div>
            )}

            {purpose === 'Donation' && (
              <div>
                <label htmlFor="donationDetails">Donation Details *</label>
                <input id="donationDetails" value={form.donationDetails} onChange={(e) => update('donationDetails', e.target.value)} required />
              </div>
            )}

            {purpose === 'Other' && (
              <div>
                <label htmlFor="otherDetails">Other Details *</label>
                <input id="otherDetails" value={form.otherDetails} onChange={(e) => update('otherDetails', e.target.value)} required />
              </div>
            )}
          </div>

          <div className="actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="secondary" onClick={resetForm} disabled={submitting}>Clear</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent entries</h3>
        <table>
          <thead>
            <tr><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td>{recent.indexOf(r) + 1}</td>
                <td>{String(r.visit_date).slice(0, 10)}</td>
                <td>{String(r.visit_time).slice(0, 8)}</td>
                <td>{r.name}</td>
                <td>{r.place}</td>
                <td>{r.phone}</td>
                <td>{r.purpose}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={7} style={{ color: '#6b7280' }}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
