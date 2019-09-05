const a = {
  a: 2,
  b () {
    return this.a;
  }
}

function main () {

  return a.b();
}