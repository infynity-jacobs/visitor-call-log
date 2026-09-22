const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const visitorsService = require('../services/visitors.service');
const { requireString, validatePhone, validateDate, validateTime, validatePositiveInt, validateNonNegativeInt, validateDateFilter } = require('../utils/validators');
const { ValidationError } = require('../middleware/errorHandler');
const { query, withTransaction } = require('../db/pool');

const router = express.Router();
router.use(authenticate);

// Fields required per selected Purpose, mirroring the conditional-field spec.
const PURPOSE_DETAIL_MAP = {
  'Bill Pay': 'purposeDetails',
  Enquiry: 'enquiryDetails',
  Complaint: 'complaintDetails',
  Purchase: 'purchaseDetails',
  Interview: 'interviewDetails',
  Donation: 'donationDetails',
  Other: 'otherDetails'
};

async function validateConfiguredOption(tableName, label, field) {
  if (!label) return null;
  const result = await query(`SELECT label FROM ${tableName} WHERE label = $1 AND is_enabled = true`, [label]);
  if (result.rows.length === 0) throw new ValidationError(`${field} must be selected from the current enabled options.`);
  return result.rows[0].label;
}

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const name = requireString(body.name, 'Name');
    const purpose = requireString(body.purpose, 'Purpose');
    await validateConfiguredOption('purpose_options', purpose, 'Purpose');
    const place = requireString(body.place, 'Place', { optional: true });
    const phone = validatePhone(body.phone, 'Phone', { optional: true });
    const visitDate = validateDate(body.visitDate, 'Date', { optional: true });
    const visitTime = validateTime(body.visitTime, 'Time', { optional: true });

    // Validate the conditional field expected for this purpose, if the spec defines one.
    if (purpose === 'Meeting') {
      await validateConfiguredOption('meeting_person_options', body.personToVisit, 'Person to Visit');
      if (!body.personToVisit) {
        throw new ValidationError('Person to Visit is required when Purpose is Meeting.');
      }
      if (body.personToVisit === 'Others' && !body.personToVisitOther) {
        throw new ValidationError('Others Details is required when Person to Visit is Others.');
      }
    } else if (PURPOSE_DETAIL_MAP[purpose]) {
      const field = PURPOSE_DETAIL_MAP[purpose];
      if (!body[field]) {
        throw new ValidationError(`Details are required for Purpose "${purpose}".`);
      }
    }

    if (purpose === 'Enquiry' && body.enquiryType) {
      await validateConfiguredOption('enquiry_type_options', body.enquiryType, 'Enquiry Type');
    }

    if (purpose === 'Enquiry' && !body.enquiryType) {
      throw new ValidationError('Enquiry Type is required when Purpose is Enquiry.');
    }

    const { record, duplicate } = await visitorsService.create({
      visitDate, visitTime, name, place, phone, purpose,
      purposeDetails: body.purposeDetails,
      enquiryType: body.enquiryType,
      enquiryDetails: body.enquiryDetails,
      complaintDetails: body.complaintDetails,
      purchaseDetails: body.purchaseDetails,
      personToVisit: body.personToVisit,
      personToVisitOther: body.personToVisitOther,
      interviewDetails: body.interviewDetails,
      donationDetails: body.donationDetails,
      otherDetails: body.otherDetails,
      createdBy: req.user.id,
      idempotencyKey: body.idempotencyKey || null
    });

    res.status(duplicate ? 200 : 201).json({ record, duplicate });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new ValidationError('Invalid record ID.');
    }

    const body = req.body;

    const name = requireString(body.name, 'Name');
    const purpose = requireString(body.purpose, 'Purpose');

    await validateConfiguredOption('purpose_options', purpose, 'Purpose');

    const place = requireString(body.place, 'Place', { optional: true });
    const phone = validatePhone(body.phone, 'Phone', { optional: true });
    const visitDate = validateDate(body.visitDate, 'Date', { optional: true });
    const visitTime = validateTime(body.visitTime, 'Time', { optional: true });

    if (purpose === 'Meeting') {
      await validateConfiguredOption(
        'meeting_person_options',
        body.personToVisit,
        'Person to Visit'
      );

      if (!body.personToVisit) {
        throw new ValidationError(
          'Person to Visit is required when Purpose is Meeting.'
        );
      }

      if (body.personToVisit === 'Others' && !body.personToVisitOther) {
        throw new ValidationError(
          'Others Details is required when Person to Visit is Others.'
        );
      }
    } else if (PURPOSE_DETAIL_MAP[purpose]) {
      const field = PURPOSE_DETAIL_MAP[purpose];

      if (!body[field]) {
        throw new ValidationError(
          `Details are required for Purpose "${purpose}".`
        );
      }
    }

    if (purpose === 'Enquiry' && body.enquiryType) {
      await validateConfiguredOption(
        'enquiry_type_options',
        body.enquiryType,
        'Enquiry Type'
      );
    }

    if (purpose === 'Enquiry' && !body.enquiryType) {
      throw new ValidationError(
        'Enquiry Type is required when Purpose is Enquiry.'
      );
    }

    const result = await withTransaction(async (client) => {
      const beforeResult = await client.query(
        `SELECT id, name, purpose FROM visitors WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (!beforeResult.rows.length) return null;

      const updatedResult = await client.query(
        `UPDATE visitors
         SET
           visit_date = COALESCE($1::date, visit_date),
           visit_time = COALESCE($2::time, visit_time),
           name = $3,
           place = $4,
           phone = $5,
           purpose = $6,
           purpose_details = $7,
           enquiry_type = $8,
           enquiry_details = $9,
           complaint_details = $10,
           purchase_details = $11,
           person_to_visit = $12,
           person_to_visit_other = $13,
           interview_details = $14,
           donation_details = $15,
           other_details = $16,
           updated_at = now()
         WHERE id = $17
         RETURNING id, name, purpose, updated_at`,
        [
          visitDate || null,
          visitTime || null,
          name,
          place,
          phone,
          purpose,
          body.purposeDetails || null,
          body.enquiryType || null,
          body.enquiryDetails || null,
          body.complaintDetails || null,
          body.purchaseDetails || null,
          body.personToVisit || null,
          body.personToVisitOther || null,
          body.interviewDetails || null,
          body.donationDetails || null,
          body.otherDetails || null,
          id
        ]
      );

      const updated = updatedResult.rows[0];

      await client.query(
        `INSERT INTO audit_log (user_id, action, details)
         VALUES ($1, $2, $3)`,
        [
          req.user.id,
          'record_update',
          {
            recordType: 'visitors',
            recordId: id,
            previousName: beforeResult.rows[0].name,
            previousPurpose: beforeResult.rows[0].purpose,
            updatedName: updated.name,
            updatedPurpose: updated.purpose
          }
        ]
      );

      return updated;
    });

    if (!result) {
      return res.status(404).json({ error: 'Visitor record not found.' });
    }

    const record = await visitorsService.getById(id);
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = validateDateFilter(req.query);
    const limitValue = validatePositiveInt(req.query.limit, 'Limit', { defaultValue: 500, min: 1, max: 1000 });
    const offsetValue = validateNonNegativeInt(req.query.offset, 'Offset', { defaultValue: 0, max: 10000000 });
    const records = await visitorsService.list({ ...filter, limit: limitValue, offset: offsetValue });
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// Configurable dropdown options used by the Visitor Register form.
router.get('/options/all', async (req, res, next) => {
  try {
    const [purpose, enquiry, meeting] = await Promise.all([
      query('SELECT id, label FROM purpose_options WHERE is_enabled = true ORDER BY sort_order, id'),
      query('SELECT id, label FROM enquiry_type_options WHERE is_enabled = true ORDER BY sort_order, id'),
      query('SELECT id, label FROM meeting_person_options WHERE is_enabled = true ORDER BY sort_order, id')
    ]);
    res.json({
      purposeOptions: purpose.rows,
      enquiryTypeOptions: enquiry.rows,
      meetingPersonOptions: meeting.rows
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const record = await visitorsService.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Visitor record not found.' });
    res.json({ record });
  } catch (err) {
    next(err);
  }
});


router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid record ID.');
    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT id, name, purpose FROM visitors WHERE id = $1', [id]);
      if (!found.rows.length) return null;
      await client.query('DELETE FROM visitors WHERE id = $1', [id]);
      await client.query('INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, 'record_delete', { recordType: 'visitors', recordId: id, deletedName: found.rows[0].name }]);
      return found.rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Record not found.' });
    res.json({ success: true, id });
  } catch (err) { next(err); }
});

module.exports = router;
