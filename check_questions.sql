-- Check M1-Q21 and M1-Q27
SELECT 
  q.id,
  q.questionNumber,
  LEFT(q.questionText, 80) as questionText,
  q.correctAnswer,
  q.createdAt,
  q.updatedAt
FROM Question q
JOIN Module m ON q.moduleId = m.id
WHERE q.questionNumber IN (21, 27)
  AND m.section = 'Math'
ORDER BY q.questionNumber;

-- Check verification logs for these questions
SELECT 
  avl.id,
  avl.questionNumber,
  avl.originalAnswer,
  avl.verifiedAnswer,
  avl.wasCorrect,
  avl.confidence,
  avl.createdAt
FROM AnswerVerificationLog avl
WHERE avl.questionNumber IN (21, 27)
ORDER BY avl.createdAt DESC
LIMIT 5;
