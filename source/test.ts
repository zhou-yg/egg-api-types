class AAA {
  public a:string = '1';
}


function getB () {

  let c = ():string => 'a';

  let aaa = new AAA();

  return {
    name: 'zhouyg',
    phone: 123456,
    c: c(),
    aaa,
  };
}

class controller {

  public getFn () {

    const b = getB();

    // b.c = 123;


    return b;
  }
}


console.log(new AAA().a);