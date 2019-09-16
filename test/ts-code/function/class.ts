class AAA {
  constructor() {
    this.a = 'class';
  }
  main() {
    return this.a + this.b();
  }

  b () {
    return 1;    
  }
}
