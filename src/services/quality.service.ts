export class QualityService {
  static async check(answer: any) {
    // Giả lập kiểm tra chất lượng
    const score = Math.random() * 100;
    return { score, label: score > 70 ? 'good' : 'needs_review' };
  }
}
