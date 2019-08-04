function getB () {

  let c = () => 'a';

  return {
    name: 'zhouyg',
    phone: 123456,
    c: c(),
  };
}

class controller {

  public getFn () {

    const b = getB();

    b.c = 123;


    return b;
  }
}
