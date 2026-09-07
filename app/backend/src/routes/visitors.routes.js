const express = require('express');
const { authenticate } = require('../middleware/auth');
const visitorsService = require('../services/visitors.service');
const { requireString, validatePhone, validateDate, validateTime } = require('../utils/validators');
const { ValidationError } = require('../middleware/errorHandler');
const { query } = require('../db/pool');

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

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const name = requireString(body.name, 'Name');
    const purpose = requireString(body.purpose, 'Purpose');
    const place = requireString(body.place, 'Place', { optional: true });
    const phone = validatePhone(body.phone, 'Phone', { optional: true });
    const visitDate = validateDate(body.visitDate, 'Date', { optional: true });
    const visitTime = validateTime(body.visitTime, 'Time', { optional: true });

    // Validate the conditional field expected for this purpose, if the spec defines one.
    if (purpose === 'Meeting') {
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

router.get('/', async (req, res, next) => {
  try {
    const { mode = 'all', date, startDate, endDate, limit, offset } = req.query;
    const records = await visitorsService.list({
      mode, date, startDate, endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });
    res.json({ records });
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

module.exports = router;
