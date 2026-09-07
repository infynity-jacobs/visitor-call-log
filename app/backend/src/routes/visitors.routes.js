const express = require('express');
const { authenticate } = require('../middleware/auth');
const visitorsService = require('../services/visitors.service');
const { requireString, validatePhone, validateDate, validateTime, validatePagination, validateDateFilter } = require('../utils/validators');
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
    const purposeOption = await query(
      'SELECT label FROM purpose_options WHERE label = $1 AND is_enabled = true', [purpose]
    );
    if (purposeOption.rows.length === 0) throw new ValidationError('Selected Purpose is not available.');
    const place = requireString(body.place, 'Place', { optional: true });
    const phone = validatePhone(body.phone, 'Phone', { optional: true });
    const visitDate = validateDate(body.visitDate, 'Date', { optional: true });
    const visitTime = validateTime(body.visitTime, 'Time', { optional: true });

    // Validate the conditional field expected for this purpose, if the spec defines one.
    if (purpose === 'Meeting') {
      if (!body.personToVisit) {
        throw new ValidationError('Person to Visit is required when Purpose is Meeting.');
      }
      const meetingOption = await query(
        'SELECT label FROM meeting_person_options WHERE label = $1 AND is_enabled = true', [body.personToVisit]
      );
      if (meetingOption.rows.length === 0) throw new ValidationError('Selected Person to Visit is not available.');
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
    if (purpose === 'Enquiry') {
      const enquiryOption = await query(
        'SELECT label FROM enquiry_type_options WHERE label = $1 AND is_enabled = true', [body.enquiryType]
      );
      if (enquiryOption.rows.length === 0) throw new ValidationError('Selected Enquiry Type is not available.');
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
    const { mode = 'all', date, startDate, endDate } = req.query;
    const filter = validateDateFilter({ mode, date, startDate, endDate }, 'Date');
    const pageLimit = validatePagination(req.query.limit, 'Limit', { defaultValue: 500, min: 1, max: 1000 });
    const pageOffset = validatePagination(req.query.offset, 'Offset', { defaultValue: 0, min: 0, max: 100000000 });
    const records = await visitorsService.list({ ...filter, limit: pageLimit, offset: pageOffset });
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

module.exports = router;
