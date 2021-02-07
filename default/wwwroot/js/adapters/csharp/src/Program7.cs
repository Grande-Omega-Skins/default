using System;
class Program
{
  public static void Main()
  {
    int[] arr = new int[] {-18, 2, 3, -7, 10, 9};
     Func<int, bool>   negative = (x) => x < 0; 
     Func<int, bool>   even =  (x) => x % 2 == 0; 
     Func<int, bool>   positiveOdd = (x) => x >0 && x % 2 !=0; 
    var t1 = negative(-3);
    var t2 = even(4);
    var t3 = positiveOdd(5);
    var t4 = positiveOdd(-3);

    var test = new Func<int, bool>(x => x % 3 == 0);
    var info = Split(arr, test);
  }


  public static Tuple<int[], int[]> Split(int[] data, Func<int, bool>filter) {
    int positive = 0;
    for (int i = 0; i < data.Length; i++) {
      if (filter(data[i]))
        positive++;
    }
    int[] pArr = new int[positive];
    int[] nArr = new int[data.Length - positive];
    int pIndex = 0;
    int nIndex = 0;
    for (int i = 0; i < data.Length; i++) {
      if (filter(data[i]))
        pArr[pIndex++] = data[i];
      else
        nArr[nIndex++] = data[i];
    }
    return Tuple.Create(pArr, nArr);
  }
}

namespace Global{
	using System;
	using System.Reflection;
	public static class Closure {
		public static string getClosure(object f, string path){
			if(f == null) return "[K]K";
			try{
				var path_split = path.Split(".");
				var f_instance = f;
				foreach (var item in path_split)
				{
					if(item == "") continue;
					try{
						f_instance = f_instance.GetType().GetProperty(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}
					catch(Exception e){
						f_instance = f_instance.GetType().GetField(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}

				}


				var closure = f_instance.GetType().GetFields(System.Reflection.BindingFlags.NonPublic |
																										System.Reflection.BindingFlags.Instance |
																										System.Reflection.BindingFlags.Public |
																										System.Reflection.BindingFlags.Static);
				var res_str = "";
				for (int i = 0; i < closure.Length; i++)
				{
						var closure_field = closure[i];
						var _f = closure_field.Name.Replace("$", "");
						var _v = closure_field.GetValue(f_instance);
						var _a = closure_field.GetValue(f_instance).GetHashCode();
						var _t = "";
						Type t = closure_field.GetValue(f_instance).GetType();
						bool isPrimitiveType = t.IsPrimitive || t.IsValueType || (t == typeof(string));
						if(isPrimitiveType){
							var tmp = closure_field.GetValue(f_instance).GetType().Name;
							_t = "#K" + tmp + "#K" + _v;
						}
						res_str += "{K" + _f + "#K" + _a + "#K" + isPrimitiveType.ToString().ToLower() + _t + "}K";
						if(i + 1 < closure.Length){
							res_str += "!K";
						}
				}
				return "[K" + "{KHashIs#K"+f_instance.GetHashCode()+"}K!K" + res_str + "]K";
			}
			catch(Exception e){
				return "[K]K";
			}
		}
	}
}