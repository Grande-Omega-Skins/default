x = 3
s = ''
b = '||'
sym = '*'
while x > 0:
  y = 2
  x = x - 1
  s = s + b
  while y > 0: 
    s = s + sym
    y = y - 1
  s = s + b + '\n'
print()