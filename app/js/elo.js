/* elo.js — pure rating math. Two "players": the learner (per-node rating) and
 * the question (difficulty). A correct answer is a win for the learner.
 * Kept dependency-free and pure so it is trivially testable.
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const DEFAULT = 1200;

  function expectedScore(a, b) {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
  }

  // K-factor decays as a rating stabilises (more attempts -> smaller swings).
  function kFactor(attempts) {
    if (attempts < 5) return 40;
    if (attempts < 15) return 24;
    return 16;
  }

  // Returns updated { learner, question } ratings after one attempt.
  // correct: 1 for right, 0 for wrong. attempts: prior attempts on this node.
  function update(learner, question, correct, attempts) {
    learner = learner || DEFAULT; question = question || DEFAULT; attempts = attempts || 0;
    const eL = expectedScore(learner, question);
    const eQ = 1 - eL;
    const kL = kFactor(attempts);
    const kQ = 12; // question difficulty moves slowly
    const newLearner = Math.round(learner + kL * (correct - eL));
    const newQuestion = Math.round(question + kQ * ((1 - correct) - eQ));
    return { learner: newLearner, question: newQuestion, expected: eL };
  }

  GP.elo = { expectedScore, kFactor, update, DEFAULT };
})();
