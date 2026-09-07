const express=require('express');
const {authenticate,requireSuperAdmin}=require('../middleware/auth');
const {ValidationError}=require('../middleware/errorHandler');
const importService=require('../services/import.service');
const router=express.Router(); router.use(authenticate,requireSuperAdmin);
function decode(body){ if(!body.fileBase64) throw new ValidationError('Excel file is required.'); const b=Buffer.from(body.fileBase64,'base64'); if(!b.length) throw new ValidationError('Uploaded Excel file is empty.'); if(b.length>8*1024*1024) throw new ValidationError('Excel file is too large. Maximum size is 8 MB.'); return b; }
router.post('/preview',async(req,res,next)=>{try{const type=req.body.type;if(!['visitors','calllog'].includes(type))throw new ValidationError('Invalid import type.');const result=await importService.preview({buffer:decode(req.body),type,filename:req.body.filename||'upload.xlsx'});res.json(result);}catch(e){next(e)}});
router.post('/commit',async(req,res,next)=>{try{const type=req.body.type;if(!['visitors','calllog'].includes(type))throw new ValidationError('Invalid import type.');const result=await importService.importWorkbook({buffer:decode(req.body),type,filename:req.body.filename||'upload.xlsx',userId:req.user.id});res.json(result);}catch(e){next(e)}});
module.exports=router;
