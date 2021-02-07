const mk_null = { kind:"null" }
const mk_node = (v,n) => ({ kind:"node", value:v, next:n })

function range(l,u) {
  if (l > u)
    return mk_null
  return mk_node(l,range(l+1, u))
}

function incr(l,k) {
  if (l.kind == "null")
    return mk_null
  return mk_node(l.value + k, incr(l.next, k))
}

let y = incr(range(0,5), 2)


0