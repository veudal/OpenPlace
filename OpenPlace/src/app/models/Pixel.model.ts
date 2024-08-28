export class Pixel {
  constructor(
    public x: number,
    public y: number,
    public color: string,
    public placedBy: string | null,
    public timestamp: string
  ) {}
}
